/**
 * 科技风格按钮组件
 * 六边形/切角矩形 + 悬停辉光 + 点击粒子
 */
import { PALETTE, FONTS } from '../data/config';
import { easeOutCubic } from '../utils/math';

export interface ButtonOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color?: string;
  fontSize?: number;
  onClick: () => void;
}

export class Button {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  fontSize: number;
  onClick: () => void;
  private _hover = false;
  private _hoverT = 0; // 悬停动画进度
  private _pressT = 0; // 按下动画
  private _enabled = true;

  constructor(opts: ButtonOptions) {
    this.x = opts.x;
    this.y = opts.y;
    this.w = opts.w;
    this.h = opts.h;
    this.text = opts.text;
    this.color = opts.color ?? PALETTE.primary;
    this.fontSize = opts.fontSize ?? 22;
    this.onClick = opts.onClick;
  }

  setEnabled(v: boolean): void {
    this._enabled = v;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  contains(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  update(dt: number): void {
    const target = this._hover ? 1 : 0;
    this._hoverT += (target - this._hoverT) * Math.min(1, dt * 10);
    if (this._pressT > 0) this._pressT = Math.max(0, this._pressT - dt * 4);
  }

  setHover(v: boolean): void {
    this._hover = v && this._enabled;
  }

  press(): void {
    if (!this._enabled) return;
    this._pressT = 1;
    this.onClick();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = easeOutCubic(this._hoverT);
    const press = this._pressT;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const scale = 1 + t * 0.04 - press * 0.05;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    const alpha = this._enabled ? 1 : 0.35;
    ctx.globalAlpha = alpha;

    // 辉光
    if (t > 0.01) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 20 * t;
    }

    // 切角矩形背景
    const r = 8;
    ctx.fillStyle = `rgba(10, 24, 56, ${0.7 + t * 0.2})`;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    this._path(ctx, r);
    ctx.fill();
    ctx.stroke();

    // 顶角装饰
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    const corner = 6;
    // 左上
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + corner);
    ctx.lineTo(this.x, this.y);
    ctx.lineTo(this.x + corner, this.y);
    ctx.stroke();
    // 右下
    ctx.beginPath();
    ctx.moveTo(this.x + this.w - corner, this.y + this.h);
    ctx.lineTo(this.x + this.w, this.y + this.h);
    ctx.lineTo(this.x + this.w, this.y + this.h - corner);
    ctx.stroke();

    // 文字
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold ${this.fontSize}px ${FONTS.body}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = t * 10;
    ctx.fillText(this.text, cx, cy);

    ctx.restore();
  }

  private _path(ctx: CanvasRenderingContext2D, r: number): void {
    const { x, y, w, h } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
