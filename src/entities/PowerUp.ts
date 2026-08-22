/**
 * 道具：6 种（武器升级/护盾/得分加倍/炸弹/回血/清屏）
 * 磁吸效果，浮动旋转绘制
 */
import { Entity } from './Entity';
import { CONFIG, PALETTE, POWERUP_COLORS } from '../data/config';
import type { PowerUpType, Vec2, Faction } from '../types';
import { pickWeighted } from '../utils/random';

export class PowerUp extends Entity {
  faction: Faction = 'powerup';
  radius = 14;
  type: PowerUpType;
  private _age = 0;
  private _player: Vec2 | null = null;

  constructor(x: number, y: number, type: PowerUpType) {
    super(x, y);
    this.type = type;
    this.color = POWERUP_COLORS[type].color;
    this.vel.y = CONFIG.powerUp.fallSpeed;
  }

  setPlayer(p: Vec2 | null): void {
    this._player = p;
  }

  update(dt: number): void {
    this._age += dt;
    // 磁吸
    if (this._player) {
      const dx = this._player.x - this.pos.x;
      const dy = this._player.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < CONFIG.powerUp.magnetRadius) {
        const pull = (1 - d / CONFIG.powerUp.magnetRadius) * 400;
        this.vel.x = (dx / (d || 1)) * pull;
        this.vel.y = (dy / (d || 1)) * pull;
      } else {
        this.vel.x *= 0.95;
        this.vel.y = CONFIG.powerUp.fallSpeed;
      }
    }
    this._applyVelocity(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const info = POWERUP_COLORS[this.type];
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this._age * 1.5);
    const pulse = 0.8 + 0.2 * Math.sin(this._age * 5);

    ctx.shadowColor = info.color;
    ctx.shadowBlur = 15 * pulse;
    ctx.strokeStyle = info.color;
    ctx.fillStyle = `rgba(10,24,56,0.85)`;
    ctx.lineWidth = 2;

    // 六边形外框
    const r = this.radius;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 字母（反向旋转保持正向）
    ctx.rotate(-this._age * 1.5);
    ctx.fillStyle = info.color;
    ctx.font = `bold 16px 'Consolas', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.letter, 0, 1);

    ctx.restore();
  }

  get name(): string {
    return POWERUP_COLORS[this.type].name;
  }
}

/** 道具工厂：按权重随机生成类型 */
export function randomPowerUpType(): PowerUpType {
  return pickWeighted(
    [
      { type: 'weapon', weight: 30 },
      { type: 'shield', weight: 15 },
      { type: 'score', weight: 20 },
      { type: 'bomb', weight: 10 },
      { type: 'heal', weight: 15 },
      { type: 'wipe', weight: 10 },
    ].map((i) => ({ item: i.type as PowerUpType, weight: i.weight })),
  );
}
