/**
 * 粒子：爆炸、拖尾、特效
 * 使用对象池管理
 */
import { Entity } from './Entity';
import { ObjectPool } from '../utils/pool';
import { CONFIG, PALETTE } from '../data/config';
import type { Faction } from '../types';

interface ParticleData {
  life: number;
  maxLife: number;
  size: number;
  color: string;
  fade: boolean;
  shape: 'circle' | 'spark' | 'ring';
  ringWidth: number;
}

export class Particle extends Entity {
  data: ParticleData = {
    life: 0,
    maxLife: 1,
    size: 3,
    color: PALETTE.primary,
    fade: true,
    shape: 'circle',
    ringWidth: 2,
  };

  faction: Faction = 'neutral';
  cullable = false;

  update(dt: number): void {
    this._applyVelocity(dt);
    this.data.life -= dt;
    if (this.data.life <= 0) {
      this.alive = false;
    }
    // 衰减
    this.vel.x *= 0.96;
    this.vel.y *= 0.96;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = Math.max(0, this.data.life / this.data.maxLife);
    const alpha = this.data.fade ? t : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.data.color;
    ctx.strokeStyle = this.data.color;
    ctx.shadowColor = this.data.color;
    ctx.shadowBlur = 8;

    const s = this.data.size * (this.data.shape === 'ring' ? 1 : t);
    switch (this.data.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, s, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'spark':
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.pos.x, this.pos.y);
        ctx.lineTo(this.pos.x - this.vel.x * 0.02, this.pos.y - this.vel.y * 0.02);
        ctx.stroke();
        break;
      case 'ring':
        ctx.lineWidth = this.data.ringWidth;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.data.size * (1 - t) * 3 + this.data.size, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  reset(): void {
    this.alive = true;
    this.data.life = this.data.maxLife;
  }
}

/** 粒子对象池 */
export class ParticleSystem {
  private _pool: ObjectPool<Particle>;
  private _active: Particle[] = [];

  constructor() {
    this._pool = new ObjectPool<Particle>(
      () => new Particle(0, 0),
      (p) => {
        p.alive = false;
      },
      64,
    );
  }

  /** 生成爆炸粒子 */
  explode(x: number, y: number, color: string = PALETTE.warning, count: number = 16, power: number = 1): void {
    if (this._active.length > CONFIG.particle.maxCount) count = Math.min(count, 8);
    for (let i = 0; i < count; i++) {
      const p = this._pool.acquire();
      p.pos.x = x;
      p.pos.y = y;
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = (80 + Math.random() * 180) * power;
      p.vel.x = Math.cos(ang) * speed;
      p.vel.y = Math.sin(ang) * speed;
      p.data.life = p.data.maxLife = 0.4 + Math.random() * 0.3;
      p.data.size = 3 + Math.random() * 3;
      p.data.color = color;
      p.data.shape = Math.random() < 0.5 ? 'circle' : 'spark';
      p.data.fade = true;
      p.alive = true;
      this._active.push(p);
    }
    // 冲击波环
    const ring = this._pool.acquire();
    ring.pos.x = x;
    ring.pos.y = y;
    ring.vel.x = 0;
    ring.vel.y = 0;
    ring.data.life = ring.data.maxLife = 0.3;
    ring.data.size = 8 * power;
    ring.data.color = color;
    ring.data.shape = 'ring';
    ring.data.ringWidth = 3;
    ring.alive = true;
    this._active.push(ring);
  }

  /** 生成拖尾粒子 */
  trail(x: number, y: number, color: string = PALETTE.primary, size: number = 2): void {
    if (this._active.length > CONFIG.particle.maxCount) return;
    const p = this._pool.acquire();
    p.pos.x = x;
    p.pos.y = y;
    p.vel.x = (Math.random() - 0.5) * 20;
    p.vel.y = 60;
    p.data.life = p.data.maxLife = 0.25;
    p.data.size = size;
    p.data.color = color;
    p.data.shape = 'circle';
    p.alive = true;
    this._active.push(p);
  }

  /** 单个粒子（自定义） */
  emit(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, shape: 'circle' | 'spark' | 'ring' = 'circle'): void {
    if (this._active.length > CONFIG.particle.maxCount) return;
    const p = this._pool.acquire();
    p.pos.x = x;
    p.pos.y = y;
    p.vel.x = vx;
    p.vel.y = vy;
    p.data.life = p.data.maxLife = life;
    p.data.size = size;
    p.data.color = color;
    p.data.shape = shape;
    p.alive = true;
    this._active.push(p);
  }

  update(dt: number): void {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p.update(dt);
      if (!p.alive) {
        this._active.splice(i, 1);
        this._pool.release(p);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this._active) p.render(ctx);
  }

  clear(): void {
    for (const p of this._active) this._pool.release(p);
    this._active.length = 0;
  }

  get count(): number {
    return this._active.length;
  }
}
