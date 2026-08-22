/**
 * 玩家飞机
 * 处理移动、射击、武器升级、护盾、炸弹、无敌
 */
import { Entity } from './Entity';
import { BulletSystem } from './Bullet';
import { ParticleSystem } from './Particle';
import { CONFIG, PALETTE, WEAPON_LEVELS } from '../data/config';
import type { InputManager } from '../systems/InputManager';
import type { Vec2, Faction } from '../types';
import { clamp, deg2rad } from '../utils/math';
import { eventBus } from '../utils/eventBus';

export class Player extends Entity {
  faction: Faction = 'player';
  radius = 14;
  hp = CONFIG.player.maxHp;
  maxHp = CONFIG.player.maxHp;
  bombs = CONFIG.player.initBombs;
  weaponLevel = 1;
  shieldTime = 0; // 护盾剩余秒
  scoreMultiplier = 1;
  scoreMultiplierTime = 0;
  invincibleTime = 0;
  private _shootCooldown = 0;
  private _slowMode = false;
  private _trailTimer = 0;
  private _input: InputManager;
  private _bullets: BulletSystem;
  private _particles: ParticleSystem;
  private _gameW: number;
  private _gameH: number;
  private _vel = { x: 0, y: 0 };
  // 触控相对偏移：手指按下处为原点，飞机按手指相对位移移动（手指不遮挡飞机）
  private _touchActive = false;
  private _touchStartX = 0;
  private _touchStartY = 0;
  private _planeStartX = 0;
  private _planeStartY = 0;

  constructor(input: InputManager, bullets: BulletSystem, particles: ParticleSystem, w: number, h: number) {
    super(w / 2, h - 120);
    this._input = input;
    this._bullets = bullets;
    this._particles = particles;
    this._gameW = w;
    this._gameH = h;
  }

  get isInvincible(): boolean {
    return this.invincibleTime > 0 || this.shieldTime > 0;
  }

  get hasShield(): boolean {
    return this.shieldTime > 0;
  }

  get isSlow(): boolean {
    return this._slowMode;
  }

  update(dt: number): void {
    this._handleMovement(dt);
    this._handleShooting(dt);
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
          const speed = CONFIG.player.speed;
          const move = Math.min(d, speed * dt);
          this.pos.x += (dx / d) * move;
          this.pos.y += (dy / d) * move;
        }
        this._slowMode = false;
      } else {
        // 键盘移动（带加速度）
        this._slowMode = this._input.isSlowMode();
        const speed = this._slowMode ? CONFIG.player.slowSpeed : CONFIG.player.speed;
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
      this._shootCooldown = 1 / wl.fireRate;
    }
  }

  private _shoot(): void {
    const wl = WEAPON_LEVELS[this.weaponLevel - 1];
    const n = wl.bullets;
    const spread = wl.spread;
    const speed = CONFIG.bullet.playerSpeed;
    const baseY = this.pos.y - this.radius;

    if (n === 1) {
      this._bullets.spawnPlayer(this.pos.x, baseY, 0, -speed, wl.damage);
    } else {
      const startAng = -spread / 2;
      for (let i = 0; i < n; i++) {
        const ang = n === 1 ? 0 : startAng + (spread / (n - 1)) * i;
        const rad = deg2rad(ang - 90);
        this._bullets.spawnPlayer(this.pos.x, baseY, Math.cos(rad) * speed, Math.sin(rad) * speed, wl.damage);
      }
    }
    // 追踪弹
    if (wl.homing > 0) {
      for (let i = 0; i < wl.homing; i++) {
        const offsetX = i === 0 ? -16 : 16;
        const b = this._bullets.spawnPlayer(this.pos.x + offsetX, baseY + 5, 0, -speed * 0.8, wl.homingDamage, {
          homing: true,
          color: PALETTE.accent,
        });
        b.radius = 5;
      }
    }
    this.game_audio_shoot();
  }

  private game_audio_shoot(): void {
    eventBus.emit('player:shoot');
  }

  private _updateStatus(dt: number): void {
    if (this.invincibleTime > 0) this.invincibleTime -= dt;
    if (this.shieldTime > 0) this.shieldTime -= dt;
    if (this.scoreMultiplierTime > 0) {
      this.scoreMultiplierTime -= dt;
      if (this.scoreMultiplierTime <= 0) this.scoreMultiplier = 1;
    }
  }

  private _emitTrail(dt: number): void {
    this._trailTimer -= dt;
    if (this._trailTimer <= 0) {
      this._trailTimer = 0.03;
      this._particles.trail(this.pos.x - 6, this.pos.y + 12, PALETTE.primary, 2);
      this._particles.trail(this.pos.x + 6, this.pos.y + 12, PALETTE.primary, 2);
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

  /** 升级武器 */
  upgradeWeapon(): boolean {
    if (this.weaponLevel >= CONFIG.player.maxWeaponLevel) return false;
    this.weaponLevel++;
    return true;
  }

  /** 拾取道具 */
  applyPowerUp(type: string): void {
    switch (type) {
      case 'weapon':
        this.upgradeWeapon();
        break;
      case 'shield':
        this.shieldTime = 30;
        break;
      case 'score':
        this.scoreMultiplier = 2;
        this.scoreMultiplierTime = 15;
        break;
      case 'bomb':
        if (this.bombs < CONFIG.player.maxBombs) this.bombs++;
        break;
      case 'heal':
        if (this.hp < this.maxHp) this.hp++;
        break;
      case 'wipe':
        this.invincibleTime = Math.max(this.invincibleTime, 1);
        break;
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

  /** 更新追踪弹目标 */
  updateHomingTargets(): void {
    // 由 GameScene 调用，传入敌人列表后设置
  }

  render(ctx: CanvasRenderingContext2D): void {
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

    // 机身（科技风三角）
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = this.hitFlash > 0 ? 25 : 12;
    const bodyColor = this.hitFlash > 0 ? '#fff' : PALETTE.primary;
    ctx.fillStyle = bodyColor;
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
      ctx.shadowColor = PALETTE.primary;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = PALETTE.primary;
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
  }
}
