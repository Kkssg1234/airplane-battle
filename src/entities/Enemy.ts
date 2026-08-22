/**
 * 敌机：6 种类型（侦察/截击/重装/自爆/护盾/隐形）
 * 不同移动模式与攻击行为
 */
import { Entity } from './Entity';
import { BulletSystem } from './Bullet';
import { ENEMY_DEFS, PALETTE, type EnemyDef } from '../data/config';
import type { EnemyTypeId, Vec2, Faction } from '../types';

export class Enemy extends Entity {
  faction: Faction = 'enemy';
  typeId: EnemyTypeId;
  def: EnemyDef;
  private _bullets: BulletSystem;
  private _fireTimer = 0;
  private _age = 0;
  private _baseX: number;
  private _target: Vec2 | null = null;
  shieldHp = 0;
  private _cloakTimer = 0; // 隐身周期
  cloaked = false;
  /** 自爆机撞击标记（由 GameScene 处理击杀反馈） */
  suicide = false;
  /** 难度缩放后的参数 */
  private _scaledFireRate: number;
  private _scaledSpeed: number;

  constructor(typeId: EnemyTypeId, x: number, y: number, bullets: BulletSystem, difficulty = 1) {
    super(x, y);
    this.typeId = typeId;
    this._bullets = bullets;
    this.def = ENEMY_DEFS[typeId];
    this.hp = Math.floor(this.def.hp * (1 + 0.1 * (difficulty - 1)));
    this.radius = this.def.radius;
    this.color = this.def.color;
    this._baseX = x;
    this._scaledFireRate = this.def.fireRate * difficulty;
    this._scaledSpeed = this.def.speed * (0.8 + 0.2 * difficulty);
    if (this.def.shielded) this.shieldHp = 3;
    this.vel.y = this._scaledSpeed;
  }

  setTarget(t: Vec2 | null): void {
    this._target = t;
  }

  update(dt: number): void {
    this._age += dt;
    this._aiUpdate(dt);
    this._handleFire(dt);
    if (this.def.cloaked) this._updateCloak(dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  private _aiUpdate(dt: number): void {
    switch (this.def.pattern) {
      case 'line':
        this._applyVelocity(dt);
        break;
      case 'sine':
        this.pos.x = this._baseX + Math.sin(this._age * 2) * 80;
        this.pos.y += this._scaledSpeed * dt;
        break;
      case 'side':
        this.pos.x += Math.sin(this._age * 1.5) * 60 * dt;
        this.pos.y += this._scaledSpeed * dt;
        break;
      case 'track':
        // 追踪玩家
        if (this._target) {
          const dx = this._target.x - this.pos.x;
          const dy = this._target.y - this.pos.y;
          const d = Math.hypot(dx, dy) || 1;
          this.vel.x = (dx / d) * this._scaledSpeed;
          this.vel.y = Math.abs(dy / d) * this._scaledSpeed; // 主要向下
        }
        this._applyVelocity(dt);
        // 自爆机接近玩家时爆炸（标记由 GameScene 处理反馈）
        if (this._target && Math.hypot(this._target.x - this.pos.x, this._target.y - this.pos.y) < 24) {
          this.alive = false;
          this.suicide = true;
        }
        break;
    }
  }

  private _handleFire(dt: number): void {
    if (this._scaledFireRate <= 0 || !this._target) return;
    this._fireTimer -= dt;
    if (this._fireTimer <= 0) {
      this._fireTimer = 1 / this._scaledFireRate;
      this._fire();
    }
  }

  private _fire(): void {
    const t = this._target;
    if (!t) return;
    const speed = this.def.bulletSpeed;
    if (this.typeId === 'E3') {
      // 三连散射
      for (let i = -1; i <= 1; i++) {
        const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x) + i * 0.25;
        this._bullets.spawnEnemy(this.pos.x, this.pos.y, Math.cos(ang) * speed, Math.sin(ang) * speed, this.color);
      }
    } else if (this.typeId === 'E5') {
      // 编队齐射（单发）
      const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x);
      this._bullets.spawnEnemy(this.pos.x, this.pos.y, Math.cos(ang) * speed, Math.sin(ang) * speed, this.color);
    } else if (this.typeId === 'E6') {
      // 突袭单发（快速）
      const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x);
      this._bullets.spawnEnemy(this.pos.x, this.pos.y, Math.cos(ang) * speed * 1.2, Math.sin(ang) * speed * 1.2, this.color);
    } else {
      const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x);
      this._bullets.spawnEnemy(this.pos.x, this.pos.y, Math.cos(ang) * speed, Math.sin(ang) * speed, this.color);
    }
  }

  private _updateCloak(dt: number): void {
    this._cloakTimer -= dt;
    if (this._cloakTimer <= 0) {
      this.cloaked = !this.cloaked;
      this._cloakTimer = this.cloaked ? 1.5 : 2.5; // 隐身1.5s，显形2.5s
    }
  }

  /** 受伤，先扣护盾 */
  takeDamage(dmg: number): boolean {
    if (this.shieldHp > 0) {
      this.shieldHp -= dmg;
      this.hitFlash = 0.08;
      if (this.shieldHp > 0) return false;
    }
    return super.takeDamage(dmg);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    if (this.cloaked) ctx.globalAlpha = 0.2;
    if (this.hitFlash > 0) ctx.globalAlpha = Math.min(1, ctx.globalAlpha + 0.5);

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.hitFlash > 0 ? '#fff' : this.color;
    ctx.strokeStyle = PALETTE.text;
    ctx.lineWidth = 1.5;

    // 不同类型不同形状
    const r = this.radius;
    switch (this.typeId) {
      case 'E1': // 侦察机：倒三角
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(-r, -r * 0.6);
        ctx.lineTo(r, -r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'E2': // 截击机：菱形
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, -r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'E3': // 重装机：六边形
        this._polygon(ctx, r, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = PALETTE.danger;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'E4': // 自爆机：圆形带尖刺
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.color;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
          ctx.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
          ctx.stroke();
        }
        break;
      case 'E5': // 护盾机：方形
        ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
        ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
        break;
      case 'E6': // 隐形机：三角带尾翼
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(-r, -r * 0.7);
        ctx.lineTo(0, -r * 0.3);
        ctx.lineTo(r, -r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }

    // 护盾
    if (this.shieldHp > 0) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = PALETTE.purple;
      ctx.shadowColor = PALETTE.purple;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private _polygon(ctx: CanvasRenderingContext2D, r: number, sides: number): void {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  get score(): number {
    return this.def.score;
  }

  get isElite(): boolean {
    return !!this.def.elite;
  }
}
