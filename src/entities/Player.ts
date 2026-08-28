/**
 * 玩家飞机
 * 处理移动、射击、武器升级、护盾、炸弹、无敌
 * v2：支持 4 款飞机（属性/武器形态/主动技能差异）、僚机伴飞、道具叠加机制
 */
import { Entity } from './Entity';
import { BulletSystem } from './Bullet';
import { ParticleSystem } from './Particle';
import { CONFIG, PALETTE, WEAPON_LEVELS, getPlane } from '../data/config';
import type { PlaneDef } from '../data/config';
import type { PlaneTypeId } from '../types';
import type { InputManager } from '../systems/InputManager';
import type { Vec2, Faction } from '../types';
import { clamp, deg2rad } from '../utils/math';
import { eventBus } from '../utils/eventBus';

/** 僚机伴飞实体（疾风机专属）：跟随主机并独立开火 */
interface Wingman {
  x: number;
  y: number;
  cooldown: number;
}

export class Player extends Entity {
  faction: Faction = 'player';
  radius = 14;

  // ============ 飞机差异化属性（由 PlaneDef 驱动） ============
  /** 当前飞机型号定义 */
  plane: PlaneDef;
  hp: number;
  maxHp: number;
  bombs = CONFIG.player.initBombs;
  weaponLevel = 1;
  shieldTime = 0; // 护盾剩余秒（可叠加）
  scoreMultiplier = 1; // 得分倍率（可叠加 2→5）
  scoreMultiplierTime = 0;
  invincibleTime = 0;

  // ============ 主动技能 ============
  /** 技能剩余冷却秒数（0=就绪） */
  skillCooldown = 0;
  /** 技能生效剩余时间（超载/要塞模式） */
  skillActiveTime = 0;

  // ============ 道具叠加增益 ============
  /** 武器满级后继续拾取武器道具叠加的伤害加成 */
  weaponDamageBonus = 0;
  /** 本局各道具累计拾取次数（用于反馈与平衡分析） */
  stackCounts: Record<string, number> = {};

  private _shootCooldown = 0;
  private _slowMode = false;
  private _trailTimer = 0;
  private _input: InputManager;
  private _bullets: BulletSystem;
  private _particles: ParticleSystem;
  private _gameW: number;
  private _gameH: number;
  private _vel = { x: 0, y: 0 };
  /** 僚机列表（疾风 2 台伴飞） */
  private _wingmen: Wingman[] = [];

  // 触控相对偏移：手指按下处为原点，飞机按手指相对位移移动（手指不遮挡飞机）
  private _touchActive = false;
  private _touchStartX = 0;
  private _touchStartY = 0;
  private _planeStartX = 0;
  private _planeStartY = 0;

  constructor(
    input: InputManager,
    bullets: BulletSystem,
    particles: ParticleSystem,
    w: number,
    h: number,
    planeType: PlaneTypeId = 'falcon',
  ) {
    super(w / 2, h - 120);
    this._input = input;
    this._bullets = bullets;
    this._particles = particles;
    this._gameW = w;
    this._gameH = h;

    // 按 PlaneDef 初始化差异化属性
    this.plane = getPlane(planeType);
    this.maxHp = this.plane.maxHp;
    this.hp = this.plane.maxHp;
    this.color = this.plane.color;

    // 僚机初始化：位于主机侧后方
    for (let i = 0; i < this.plane.wingmen; i++) {
      this._wingmen.push({ x: this.pos.x + (i === 0 ? -26 : 26), y: this.pos.y + 16, cooldown: 0 });
    }
  }

  get isInvincible(): boolean {
    // 要塞模式期间无敌
    return this.invincibleTime > 0 || this.shieldTime > 0 || (this.plane.skill.id === 'fortress' && this.skillActiveTime > 0);
  }

  get hasShield(): boolean {
    return this.shieldTime > 0;
  }

  get isSlow(): boolean {
    return this._slowMode;
  }

  /** 技能是否就绪 */
  get skillReady(): boolean {
    return this.skillCooldown <= 0;
  }

  /** 护盾叠加上限（堡垒机强化） */
  private get _shieldMax(): number {
    return this.plane.id === 'fortress' ? CONFIG.powerUpStack.fortressShieldMaxTime : CONFIG.powerUpStack.shieldMaxTime;
  }

  update(dt: number): void {
    this._handleMovement(dt);
    this._handleShooting(dt);
    this._updateWingmen(dt);
    this._updateStatus(dt);
    this._emitTrail(dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  private _handleMovement(dt: number): void {
    if (this._input.scheme === 'touch') {
      // 移动端：相对偏移触控
      this._handleTouchMove();
    } else {
      const follow = this._input.getFollowTarget();
      if (follow) {
        // 鼠标绝对跟随（桌面端）
        const dx = follow.x - this.pos.x;
        const dy = follow.y - this.pos.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          const speed = this._effectiveSpeed();
          const move = Math.min(d, speed * dt);
          this.pos.x += (dx / d) * move;
          this.pos.y += (dy / d) * move;
        }
        this._slowMode = false;
      } else {
        // 键盘移动（带加速度）
        this._slowMode = this._input.isSlowMode();
        const speed = this._slowMode ? CONFIG.player.slowSpeed : this._effectiveSpeed();
        const dir = this._input.getMoveDir();
        const targetVx = dir ? dir.x * speed : 0;
        const targetVy = dir ? dir.y * speed : 0;
        const accelRate = 1 / CONFIG.player.accel;
        this._vel.x += (targetVx - this._vel.x) * Math.min(1, accelRate * dt * 6);
        this._vel.y += (targetVy - this._vel.y) * Math.min(1, accelRate * dt * 6);
        this.pos.x += this._vel.x * dt;
        this.pos.y += this._vel.y * dt;
      }
    }

    // 边界
    this.pos.x = clamp(this.pos.x, this.radius, this._gameW - this.radius);
    this.pos.y = clamp(this.pos.y, this.radius, this._gameH - this.radius);
  }

  /** 实际移动速度：飞机基础速度 × 疾风超载加成 */
  private _effectiveSpeed(): number {
    const boost = this.plane.skill.id === 'overdrive' && this.skillActiveTime > 0 && this.plane.id === 'swift' ? 1.3 : 1;
    return this.plane.speed * boost;
  }

  /**
   * 移动端相对偏移操控：
   * 手指按下时记录手指起点与飞机起点，移动时飞机位置 = 飞机起点 + (当前手指 - 手指起点)
   * 飞机与手指保持固定偏移，手指不遮挡飞机；1:1 直接定位，无延迟
   */
  private _handleTouchMove(): void {
    const ptr = this._input.getPointer();
    if (!this._touchActive && ptr.down) {
      this._touchActive = true;
      this._touchStartX = ptr.x;
      this._touchStartY = ptr.y;
      this._planeStartX = this.pos.x;
      this._planeStartY = this.pos.y;
    }
    if (this._touchActive) {
      if (!ptr.down) {
        this._touchActive = false;
      } else {
        this.pos.x = this._planeStartX + (ptr.x - this._touchStartX);
        this.pos.y = this._planeStartY + (ptr.y - this._touchStartY);
      }
    }
    this._slowMode = false;
  }

  private _handleShooting(dt: number): void {
    this._shootCooldown -= dt;
    if (this._input.isShooting() && this._shootCooldown <= 0) {
      this._shoot();
      const wl = WEAPON_LEVELS[this.weaponLevel - 1];
      // 实际射速 = 武器基础射速 × 飞机射速倍率 × 技能超载加成
      let fireRate = wl.fireRate * this.plane.fireRateMult;
      if (this.plane.skill.id === 'overdrive' && this.skillActiveTime > 0) {
        fireRate *= this.plane.id === 'swift' ? 2.2 : 1.8;
      }
      this._shootCooldown = 1 / fireRate;
    }
  }

  /** 计算单发伤害：武器基础 × 飞机倍率 + 满级叠加加成 + 技能加成 */
  private _bulletDamage(): number {
    let dmg = this.weaponLevel > 0 ? WEAPON_LEVELS[this.weaponLevel - 1].damage : 1;
    dmg *= this.plane.damageMult;
    dmg += this.weaponDamageBonus;
    if (this.plane.skill.id === 'overdrive' && this.skillActiveTime > 0 && this.plane.id === 'falcon') dmg *= 1.5;
    if (this.plane.skill.id === 'fortress' && this.skillActiveTime > 0) dmg *= 1.5;
    return dmg;
  }

  private _shoot(): void {
    const wl = WEAPON_LEVELS[this.weaponLevel - 1];
    // 总子弹数 = 武器等级子弹数 + 飞机额外散射（堡垒弹幕形态）
    const n = wl.bullets + this.plane.extraSpread;
    // 散射角随子弹数展宽，保证弹幕覆盖面
    const spread = n > 1 ? Math.max(wl.spread, (n - 1) * 9) : 0;
    const speed = CONFIG.bullet.playerSpeed;
    const baseY = this.pos.y - this.radius;
    const damage = this._bulletDamage();

    if (n === 1) {
      this._bullets.spawnPlayer(this.pos.x, baseY, 0, -speed, damage);
    } else {
      const startAng = -spread / 2;
      for (let i = 0; i < n; i++) {
        const ang = startAng + (spread / (n - 1)) * i;
        const rad = deg2rad(ang - 90);
        this._bullets.spawnPlayer(this.pos.x, baseY, Math.cos(rad) * speed, Math.sin(rad) * speed, damage);
      }
    }
    // 追踪弹：武器等级配置 + 幻影机加成
    const homingCount = wl.homing + this.plane.homingBonus;
    if (homingCount > 0) {
      const homingDmg = (wl.homingDamage || 0.5) * this.plane.damageMult;
      for (let i = 0; i < homingCount; i++) {
        // 多发追踪弹左右交错布置
        const offsetX = homingCount === 1 ? 0 : (i % 2 === 0 ? -1 : 1) * (10 + Math.floor(i / 2) * 12);
        const b = this._bullets.spawnPlayer(this.pos.x + offsetX, baseY + 5, 0, -speed * 0.8, homingDmg, {
          homing: true,
          color: this.plane.color,
        });
        b.radius = 5;
      }
    }
    this.game_audio_shoot();
  }

  /** 僚机伴飞更新（疾风机）：跟随主机 + 独立低频开火 */
  private _updateWingmen(dt: number): void {
    for (let i = 0; i < this._wingmen.length; i++) {
      const wm = this._wingmen[i];
      // 目标位置：主机侧后方，带轻微浮动
      const side = i === 0 ? -1 : 1;
      const targetX = this.pos.x + side * 26;
      const targetY = this.pos.y + 16 + Math.sin(performance.now() / 300 + i * 2) * 4;
      // 平滑跟随（延迟感）
      wm.x += (targetX - wm.x) * Math.min(1, dt * 8);
      wm.y += (targetY - wm.y) * Math.min(1, dt * 8);
      // 开火：主机射速的一半，伤害 0.5×
      wm.cooldown -= dt;
      if (this._input.isShooting() && wm.cooldown <= 0 && this.alive) {
        const wl = WEAPON_LEVELS[this.weaponLevel - 1];
        let fireRate = wl.fireRate * this.plane.fireRateMult * 0.5;
        if (this.plane.skill.id === 'overdrive' && this.skillActiveTime > 0) fireRate *= 2.2;
        wm.cooldown = 1 / fireRate;
        this._bullets.spawnPlayer(wm.x, wm.y - 8, 0, -CONFIG.bullet.playerSpeed, 0.5 * this.plane.damageMult);
      }
    }
  }

  private game_audio_shoot(): void {
    eventBus.emit('player:shoot');
  }

  private _updateStatus(dt: number): void {
    if (this.invincibleTime > 0) this.invincibleTime -= dt;
    if (this.shieldTime > 0) this.shieldTime -= dt;
    if (this.skillCooldown > 0) this.skillCooldown -= dt;
    if (this.skillActiveTime > 0) this.skillActiveTime -= dt;
    if (this.scoreMultiplierTime > 0) {
      this.scoreMultiplierTime -= dt;
      if (this.scoreMultiplierTime <= 0) this.scoreMultiplier = 1;
    }
  }

  private _emitTrail(dt: number): void {
    this._trailTimer -= dt;
    if (this._trailTimer <= 0) {
      this._trailTimer = 0.03;
      this._particles.trail(this.pos.x - 6, this.pos.y + 12, this.plane.color, 2);
      this._particles.trail(this.pos.x + 6, this.pos.y + 12, this.plane.color, 2);
      // 僚机尾迹
      for (const wm of this._wingmen) {
        this._particles.trail(wm.x, wm.y + 10, this.plane.color, 1);
      }
    }
  }

  /** 受伤，返回是否真的受伤 */
  takeDamage(dmg = 1): boolean {
    if (this.isInvincible) return false;
    if (this.shieldTime > 0) {
      this.shieldTime = 0;
      this.invincibleTime = 0.5;
      eventBus.emit('player:hit', { shieldBroken: true });
      return false;
    }
    this.hp -= dmg;
    this.invincibleTime = CONFIG.player.invincibleTime;
    this.hitFlash = 0.2;
    // 武器降级
    if (this.weaponLevel > 1) this.weaponLevel--;
    eventBus.emit('player:hit', { damage: dmg, hp: this.hp });
    if (this.hp <= 0) {
      this.alive = false;
      eventBus.emit('player:death');
    }
    return true;
  }

  /** 使用炸弹 */
  useBomb(): boolean {
    if (this.bombs <= 0) return false;
    this.bombs--;
    this.invincibleTime = Math.max(this.invincibleTime, CONFIG.player.bombInvincibleTime);
    eventBus.emit('bomb:use');
    return true;
  }

  /**
   * 释放主动技能（GameScene 消费按键/按钮后调用）
   * 返回技能 ID 供场景处理特殊效果（如幻影相位清屏），null 表示冷却中
   */
  tryUseSkill(): string | null {
    if (!this.skillReady || !this.alive) return null;
    const skill = this.plane.skill;
    this.skillCooldown = skill.cooldown;
    this.skillActiveTime = skill.duration;
    // 相位闪避：瞬发无敌
    if (skill.id === 'phase') {
      this.invincibleTime = Math.max(this.invincibleTime, skill.duration);
    }
    eventBus.emit('skill:use', { skill: skill.id });
    return skill.id;
  }

  /** 升级武器 */
  upgradeWeapon(): boolean {
    if (this.weaponLevel >= CONFIG.player.maxWeaponLevel) return false;
    this.weaponLevel++;
    return true;
  }

  /**
   * 拾取道具（v2 叠加机制）
   * - weapon：未满级升级；满级后叠加伤害加成（增益递增）
   * - shield：时间叠加直至上限（堡垒上限更高）
   * - score：倍率叠加 2→5，时间刷新
   * - bomb/heal：满额时转化为补偿分数
   * 返回实际获得的效果描述（供 HUD 反馈）
   */
  applyPowerUp(type: string): string {
    this.stackCounts[type] = (this.stackCounts[type] ?? 0) + 1;
    switch (type) {
      case 'weapon':
        if (this.upgradeWeapon()) return '武器升级';
        // 满级叠加：每件 +0.25 伤害，可无限叠加
        this.weaponDamageBonus += CONFIG.powerUpStack.weaponDamageBonus;
        return `火力强化 +${CONFIG.powerUpStack.weaponDamageBonus}`;
      case 'shield': {
        if (this.shieldTime >= this._shieldMax) return '护盾已满 +分';
        this.shieldTime = Math.min(this._shieldMax, this.shieldTime + CONFIG.powerUpStack.shieldAddTime);
        return `护盾 ${Math.ceil(this.shieldTime)}s`;
      }
      case 'score':
        // 倍率逐次叠加，时间刷新
        this.scoreMultiplier = Math.min(CONFIG.powerUpStack.scoreMaxMultiplier, this.scoreMultiplier + 1);
        if (this.scoreMultiplier < 2) this.scoreMultiplier = 2;
        this.scoreMultiplierTime = CONFIG.powerUpStack.scoreAddTime;
        return `得分 ×${this.scoreMultiplier}`;
      case 'bomb':
        if (this.bombs < CONFIG.player.maxBombs) {
          this.bombs++;
          return '炸弹 +1';
        }
        return '炸弹已满 +分';
      case 'heal':
        if (this.hp < this.maxHp) {
          this.hp++;
          return '修复 +1';
        }
        return '装甲完好 +分';
      case 'wipe':
        this.invincibleTime = Math.max(this.invincibleTime, 1);
        return '清屏';
      default:
        return '';
    }
  }

  /** 满额道具的补偿分数（由 GameScene 结算） */
  isStackedFull(type: string): boolean {
    switch (type) {
      case 'shield':
        return this.shieldTime >= this._shieldMax;
      case 'bomb':
        return this.bombs >= CONFIG.player.maxBombs;
      case 'heal':
        return this.hp >= this.maxHp;
      default:
        return false;
    }
  }

  /** 寻找最近敌机作为追踪目标 */
  findTarget(enemies: { pos: Vec2 }[]): Vec2 | null {
    let best: Vec2 | null = null;
    let bestD = Infinity;
    for (const e of enemies) {
      const d = (e.pos.x - this.pos.x) ** 2 + (e.pos.y - this.pos.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e.pos;
      }
    }
    return best;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 技能生效光环（超载/要塞）
    if (this.skillActiveTime > 0 && this.plane.skill.id !== 'phase') {
      this._renderSkillAura(ctx);
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // 无敌闪烁
    if (this.invincibleTime > 0 && Math.floor(this.invincibleTime * 12) % 2 === 0 && this.shieldTime <= 0) {
      ctx.globalAlpha = 0.4;
    }

    // 引擎尾焰
    const flame = 8 + Math.random() * 6;
    ctx.shadowColor = PALETTE.warning;
    ctx.shadowBlur = 15;
    ctx.fillStyle = PALETTE.warning;
    ctx.beginPath();
    ctx.moveTo(-5, 10);
    ctx.lineTo(0, 10 + flame);
    ctx.lineTo(5, 10);
    ctx.closePath();
    ctx.fill();

    // 机身（科技风三角，颜色随飞机型号）
    ctx.shadowColor = this.plane.color;
    ctx.shadowBlur = this.hitFlash > 0 ? 25 : 12;
    const bodyColor = this.hitFlash > 0 ? '#fff' : this.plane.color;
    ctx.fillStyle = bodyColor;
    if (this.plane.id === 'fortress') {
      // 堡垒：宽体重甲造型
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(-18, 2);
      ctx.lineTo(-16, 12);
      ctx.lineTo(-6, 8);
      ctx.lineTo(6, 8);
      ctx.lineTo(16, 12);
      ctx.lineTo(18, 2);
      ctx.closePath();
      ctx.fill();
    } else if (this.plane.id === 'phantom') {
      // 幻影：细长尖锐造型
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(-9, 6);
      ctx.lineTo(-4, 12);
      ctx.lineTo(4, 12);
      ctx.lineTo(9, 6);
      ctx.closePath();
      ctx.fill();
    } else {
      // 猎鹰/疾风：标准三角
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-12, 8);
      ctx.lineTo(-6, 4);
      ctx.lineTo(-6, 12);
      ctx.lineTo(6, 12);
      ctx.lineTo(6, 4);
      ctx.lineTo(12, 8);
      ctx.closePath();
      ctx.fill();
    }

    // 机翼描边
    ctx.strokeStyle = PALETTE.text;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 驾驶舱
    ctx.fillStyle = PALETTE.accent;
    ctx.shadowColor = PALETTE.accent;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -4, 4, 0, Math.PI * 2);
    ctx.fill();

    // 慢速判定点
    if (this._slowMode) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = PALETTE.danger;
      ctx.fillStyle = PALETTE.danger;
      ctx.beginPath();
      ctx.arc(0, 0, CONFIG.player.hitboxRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 护盾
    if (this.shieldTime > 0) {
      const pulse = 0.6 + 0.3 * Math.sin(performance.now() / 100);
      ctx.globalAlpha = pulse;
      ctx.shadowColor = this.plane.color;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = this.plane.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      // 六边形护盾
      ctx.globalAlpha = pulse * 0.3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + performance.now() / 1000;
        const r = this.radius + 10;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();

    // 僚机渲染（疾风机）
    for (const wm of this._wingmen) {
      this._renderWingman(ctx, wm);
    }
  }

  /** 僚机绘制：小型三角机身 */
  private _renderWingman(ctx: CanvasRenderingContext2D, wm: Wingman): void {
    ctx.save();
    ctx.translate(wm.x, wm.y);
    ctx.globalAlpha = 0.85;
    ctx.shadowColor = this.plane.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = this.plane.color;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(-6, 5);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.fill();
    // 尾焰
    ctx.fillStyle = PALETTE.warning;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-2, 5, 4, 4 + Math.random() * 3);
    ctx.restore();
  }

  /** 技能光环：环绕机身的能量圈 */
  private _renderSkillAura(ctx: CanvasRenderingContext2D): void {
    const t = performance.now() / 200;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t);
    ctx.strokeStyle = this.plane.id === 'fortress' ? PALETTE.warning : PALETTE.accent;
    ctx.shadowColor = ctx.strokeStyle as string;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2.5;
    // 旋转双弧
    for (let i = 0; i < 2; i++) {
      const start = t * 2 + i * Math.PI;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 14, start, start + Math.PI * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }
}
