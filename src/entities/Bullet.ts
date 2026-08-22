/**
 * 子弹：玩家子弹与敌机子弹
 * 使用对象池管理
 */
import { Entity } from './Entity';
import { ObjectPool } from '../utils/pool';
import { CONFIG, PALETTE } from '../data/config';
import type { BulletOwner, Vec2 } from '../types';

export class Bullet extends Entity {
  owner: BulletOwner = 'player';
  damage = 1;
  /** 追踪目标（玩家追踪弹用） */
  target: Vec2 | null = null;
  homing = false;
  homingTurn = 4; // 追踪转向速率
  color: string = PALETTE.primary;
  /** 生命时长（秒），0=无限直到出屏 */
  life = 0;

  constructor() {
    super(0, 0);
    this.faction = 'playerBullet';
    this.radius = CONFIG.bullet.playerRadius;
  }

  update(dt: number): void {
    // 追踪
    if (this.homing && this.target) {
      const desired = Math.atan2(this.target.y - this.pos.y, this.target.x - this.pos.x);
      const current = Math.atan2(this.vel.y, this.vel.x);
      let diff = desired - current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = this.homingTurn * dt;
      const newAng = current + Math.max(-turn, Math.min(turn, diff));
      const speed = Math.hypot(this.vel.x, this.vel.y);
      this.vel.x = Math.cos(newAng) * speed;
      this.vel.y = Math.sin(newAng) * speed;
    }
    this._applyVelocity(dt);
    if (this.life > 0) {
      this.life -= dt;
      if (this.life <= 0) this.alive = false;
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const ang = Math.atan2(this.vel.y, this.vel.x);
    ctx.rotate(ang);

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = this.color;

    if (this.owner === 'player') {
      // 玩家子弹：流线型
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, -3);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-6, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(2, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 敌机子弹：圆球带光晕
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** 子弹对象池 + 管理器 */
export class BulletSystem {
  private _pool: ObjectPool<Bullet>;
  private _active: Bullet[] = [];

  constructor() {
    this._pool = new ObjectPool<Bullet>(
      () => new Bullet(),
      (b) => {
        b.alive = false;
        b.homing = false;
        b.target = null;
        b.life = 0;
      },
      64,
    );
  }

  /** 发射玩家子弹 */
  spawnPlayer(x: number, y: number, vx: number, vy: number, damage = 1, opts?: { homing?: boolean; target?: Vec2 | null; color?: string }): Bullet {
    const b = this._pool.acquire();
    b.pos.x = x;
    b.pos.y = y;
    b.vel.x = vx;
    b.vel.y = vy;
    b.owner = 'player';
    b.faction = 'playerBullet';
    b.damage = damage;
    b.radius = CONFIG.bullet.playerRadius;
    b.color = opts?.color ?? PALETTE.primary;
    b.homing = opts?.homing ?? false;
    b.target = opts?.target ?? null;
    b.life = 0;
    b.alive = true;
    this._active.push(b);
    return b;
  }

  /** 发射敌机子弹 */
  spawnEnemy(x: number, y: number, vx: number, vy: number, color: string = PALETTE.accent, radius: number = CONFIG.bullet.enemyRadius): Bullet {
    const b = this._pool.acquire();
    b.pos.x = x;
    b.pos.y = y;
    b.vel.x = vx;
    b.vel.y = vy;
    b.owner = 'enemy';
    b.faction = 'enemyBullet';
    b.damage = 1;
    b.radius = radius;
    b.color = color;
    b.homing = false;
    b.life = 0;
    b.alive = true;
    this._active.push(b);
    return b;
  }

  update(dt: number, w: number, h: number): void {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const b = this._active[i];
      b.update(dt);
      if (!b.alive || b.isOffscreen(w, h, 50)) {
        this._active.splice(i, 1);
        this._pool.release(b);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const b of this._active) b.render(ctx);
  }

  get active(): Bullet[] {
    return this._active;
  }

  /** 移除指定子弹（碰撞后） */
  remove(b: Bullet): void {
    const i = this._active.indexOf(b);
    if (i >= 0) {
      this._active.splice(i, 1);
      this._pool.release(b);
    }
  }

  clear(): void {
    for (const b of this._active) this._pool.release(b);
    this._active.length = 0;
  }

  get count(): number {
    return this._active.length;
  }
}
