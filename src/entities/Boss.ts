/**
 * BOSS：多阶段、多弹幕模式、弱点机制
 * 6 个 BOSS 主题，统一行为框架，外观/弹幕偏好按关卡区分
 */
import { Entity } from './Entity';
import { BulletSystem } from './Bullet';
import { ParticleSystem } from './Particle';
import { PALETTE, DESIGN_WIDTH } from '../data/config';
import type { Vec2, Faction } from '../types';
import { eventBus } from '../utils/eventBus';
import { clamp } from '../utils/math';

export interface BossTheme {
  id: number;
  name: string;
  color: string;
  maxHp: number;
}

export const BOSS_THEMES: BossTheme[] = [
  { id: 1, name: '「铁壁」要塞', color: PALETTE.primary, maxHp: 120 },
  { id: 2, name: '「散射」蜂巢', color: PALETTE.warning, maxHp: 160 },
  { id: 3, name: '「追踪」猎手', color: PALETTE.green, maxHp: 200 },
  { id: 4, name: '「编队」指挥', color: PALETTE.purple, maxHp: 240 },
  { id: 5, name: '「幻影」幽灵', color: PALETTE.accent, maxHp: 280 },
  { id: 6, name: '「终焉」核心', color: PALETTE.danger, maxHp: 400 },
  { id: 7, name: '「深渊」巨兽', color: '#7A00B8', maxHp: 480 },
  { id: 8, name: '「虚空」主宰', color: '#FF6600', maxHp: 640 },
];

type Phase = 1 | 2 | 3;
type Pattern = 'spiral' | 'spread' | 'tracking' | 'sweep' | 'summon';

export class Boss extends Entity {
  faction: Faction = 'enemy';
  radius = 50;
  theme: BossTheme;
  maxHp: number;
  hp: number;
  private _bullets: BulletSystem;
  private _particles: ParticleSystem;
  private _target: Vec2 | null = null;
  private _age = 0;
  private _phase: Phase = 1;
  private _patternTimer = 0;
  private _patternIndex = 0;
  private _spiralAngle = 0;
  private _entering = true;
  private _enterY = 0;
  private _targetY = 120;
  private _hitFlash = 0;
  private _sweepDir = 1;
  private _patterns: Pattern[];
  private _summonCooldown = 0;

  constructor(theme: BossTheme, x: number, bullets: BulletSystem, particles: ParticleSystem) {
    super(x, -80);
    this.theme = theme;
    this.maxHp = theme.maxHp;
    this.hp = theme.maxHp;
    this.color = theme.color;
    this._bullets = bullets;
    this._particles = particles;
    this._enterY = this._targetY;
    // 不同 BOSS 弹幕偏好
    this._patterns = this._buildPatterns(theme.id);
  }

  private _buildPatterns(id: number): Pattern[] {
    const base: Pattern[] = ['spiral', 'spread', 'sweep'];
    if (id >= 2) base.push('tracking');
    if (id >= 4) base.push('summon');
    if (id >= 6) base.push('tracking', 'sweep');
    return base;
  }

  setTarget(t: Vec2 | null): void {
    this._target = t;
  }

  get phase(): Phase {
    return this._phase;
  }

  get isEntering(): boolean {
    return this._entering;
  }

  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  /** 是否处于弱点暴露（Phase3 双倍伤害） */
  get weakPoint(): boolean {
    return this._phase === 3;
  }

  update(dt: number): void {
    this._age += dt;
    if (this._entering) {
      this.pos.y += (this._targetY - this.pos.y) * Math.min(1, dt * 1.5);
      if (Math.abs(this.pos.y - this._targetY) < 1) {
        this._entering = false;
        eventBus.emit('level:start', { bossFight: true });
      }
      return;
    }
    this._updateMovement(dt);
    this._updatePhase();
    this._updatePattern(dt);
    if (this._hitFlash > 0) this._hitFlash -= dt;
    if (this._summonCooldown > 0) this._summonCooldown -= dt;
  }

  private _updateMovement(dt: number): void {
    // 左右游走
    const range = 180;
    this.pos.x = DESIGN_WIDTH / 2 + Math.sin(this._age * 0.6) * range;
    this.pos.y = this._targetY + Math.sin(this._age * 0.4) * 20;
  }

  private _updatePhase(): void {
    const ratio = this.hpRatio;
    let newPhase: Phase = 1;
    if (ratio < 0.33) newPhase = 3;
    else if (ratio < 0.66) newPhase = 2;
    if (newPhase !== this._phase) {
      this._phase = newPhase;
      this._patternTimer = 0;
      // 阶段切换爆发粒子
      this._particles.explode(this.pos.x, this.pos.y, this.color, 24, 1.5);
    }
  }

  private _updatePattern(dt: number): void {
    this._patternTimer -= dt;
    const speedMul = this._phase === 3 ? 1.6 : 1;
    if (this._patternTimer > 0) return;
    const pattern = this._patterns[this._patternIndex % this._patterns.length];
    this._patternIndex++;
    // 每个模式持续时间
    this._patternTimer = (this._phase === 3 ? 1.2 : 1.8) / speedMul;
    this._firePattern(pattern);
  }

  private _firePattern(p: Pattern): void {
    const speedMul = this._phase === 3 ? 1.2 : 1;
    switch (p) {
      case 'spiral':
        this._spiral(speedMul);
        break;
      case 'spread':
        this._spread(speedMul);
        break;
      case 'tracking':
        this._tracking(speedMul);
        break;
      case 'sweep':
        this._sweep(speedMul);
        break;
      case 'summon':
        this._summon();
        break;
    }
  }

  private _spiral(speedMul: number): void {
    // 螺旋弹幕：连续发射多波
    const arms = 4;
    const bulletsPerWave = this._phase >= 2 ? 3 : 2;
    for (let w = 0; w < bulletsPerWave; w++) {
      setTimeout(() => {
        if (!this.alive) return;
        for (let i = 0; i < arms; i++) {
          const ang = this._spiralAngle + (i / arms) * Math.PI * 2;
          const speed = 160 * speedMul;
          this._bullets.spawnEnemy(this.pos.x, this.pos.y, Math.cos(ang) * speed, Math.sin(ang) * speed, this.color);
        }
        this._spiralAngle += 0.3;
      }, w * 120);
    }
  }

  private _spread(speedMul: number): void {
    if (!this._target) return;
    const baseAng = Math.atan2(this._target.y - this.pos.y, this._target.x - this.pos.x);
    const count = this._phase >= 2 ? 7 : 5;
    const spread = 0.8;
    for (let i = 0; i < count; i++) {
      const ang = baseAng - spread / 2 + (spread / (count - 1)) * i;
      const speed = 200 * speedMul;
      this._bullets.spawnEnemy(this.pos.x, this.pos.y, Math.cos(ang) * speed, Math.sin(ang) * speed, this.color);
    }
  }

  private _tracking(speedMul: number): void {
    if (!this._target) return;
    const ang = Math.atan2(this._target.y - this.pos.y, this._target.x - this.pos.x);
    const speed = 180 * speedMul;
    // 发射 3 发追踪
    for (let i = -1; i <= 1; i++) {
      const b = this._bullets.spawnEnemy(this.pos.x + i * 20, this.pos.y, Math.cos(ang) * speed, Math.sin(ang) * speed, PALETTE.accent);
      b.radius = 7;
    }
  }

  private _sweep(speedMul: number): void {
    // 屏幕扫射：从一侧扫到另一侧
    const count = 12;
    const speed = 220 * speedMul;
    const startAng = this._sweepDir > 0 ? -Math.PI / 2 - 0.6 : -Math.PI / 2 + 0.6;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (!this.alive) return;
        const ang = startAng + (this._sweepDir * 1.2 * i) / count;
        this._bullets.spawnEnemy(this.pos.x, this.pos.y, Math.cos(ang) * speed, Math.sin(ang) * speed, this.color);
      }, i * 50);
    }
    this._sweepDir *= -1;
  }

  private _summon(): void {
    // 召唤小怪（通过事件，GameScene 监听生成）
    if (this._summonCooldown > 0) return;
    this._summonCooldown = 5;
    eventBus.emit('boss:summon', { x: this.pos.x, y: this.pos.y });
  }

  takeDamage(dmg: number): boolean {
    const actual = this.weakPoint ? dmg * 2 : dmg;
    this.hp -= actual;
    this._hitFlash = 0.06;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      eventBus.emit('boss:kill', { boss: this });
      return true;
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // 出场扫描线
    if (this._entering) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const y = -80 + i * 20 + (this._age * 200) % 100;
        ctx.beginPath();
        ctx.moveTo(-60, y);
        ctx.lineTo(60, y);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this._hitFlash > 0 ? 35 : 20;

    // 主体（大型多边形，根据关卡变化）
    const r = this.radius;
    ctx.fillStyle = this._hitFlash > 0 ? '#fff' : `rgba(10,24,56,0.9)`;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;

    const sides = 6 + (this.theme.id % 3);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + this._age * 0.2;
      const rr = r * (1 + 0.1 * Math.sin(this._age * 2 + i));
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 核心
    const coreR = r * 0.4 * (this.weakPoint ? 1.3 : 1);
    ctx.fillStyle = this.weakPoint ? PALETTE.warning : this.color;
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fill();

    // 旋转光环
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    for (let ring = 0; ring < 2; ring++) {
      ctx.beginPath();
      const ringR = r * (1.3 + ring * 0.2);
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        if (i % 2 !== 0) continue;
        const a1 = (i / segs) * Math.PI * 2 + this._age * (ring % 2 === 0 ? 1 : -1);
        const a2 = ((i + 1) / segs) * Math.PI * 2 + this._age * (ring % 2 === 0 ? 1 : -1);
        ctx.moveTo(Math.cos(a1) * ringR, Math.sin(a1) * ringR);
        ctx.arc(0, 0, ringR, a1, a2);
      }
      ctx.stroke();
    }

    ctx.restore();

    // 血量条（屏幕顶部）
    this._renderHealthBar(ctx);
  }

  private _renderHealthBar(ctx: CanvasRenderingContext2D): void {
    if (this._entering) return;
    const w = 360;
    const h = 14;
    const x = (DESIGN_WIDTH - w) / 2;
    const y = 36;
    ctx.save();
    ctx.fillStyle = 'rgba(10,24,56,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    // 血量
    const ratio = clamp(this.hpRatio, 0, 1);
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, this.color);
    grad.addColorStop(1, PALETTE.warning);
    ctx.fillStyle = grad;
    ctx.fillRect(x + 2, y + 2, (w - 4) * ratio, h - 4);
    // 阶段标记
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    [0.33, 0.66].forEach((m) => {
      ctx.beginPath();
      ctx.moveTo(x + w * m, y);
      ctx.lineTo(x + w * m, y + h);
      ctx.stroke();
    });
    // 名字
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 13px 'Consolas', monospace`;
    ctx.textAlign = 'center';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillText(this.theme.name, DESIGN_WIDTH / 2, y - 8);
    ctx.restore();
  }
}
