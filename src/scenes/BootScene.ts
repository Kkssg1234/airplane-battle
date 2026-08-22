/**
 * 启动场景：显示标题画面，点击/按键进入主菜单
 * 同时负责解锁音频（需用户交互）
 */
import { Scene } from './Scene';
import type { Game } from '../game/Game';
import { PALETTE, FONTS } from '../data/config';
import { easeOutCubic } from '../utils/math';

export class BootScene extends Scene {
  private _t = 0;
  private _enterT = 0;

  onEnter(): void {
    super.onEnter();
    this._t = 0;
    this._enterT = 0;
  }

  update(dt: number): void {
    this._t += dt;
    this._enterT = Math.min(1, this._enterT + dt * 1.5);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, w, h);

    this._drawStarfield(ctx);
    this._drawGrid(ctx);

    const t = easeOutCubic(this._enterT);
    ctx.save();
    ctx.globalAlpha = t;

    // 标题
    const cx = w / 2;
    const cy = h * 0.38;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 30;
    ctx.fillStyle = PALETTE.primary;
    ctx.font = `bold ${56 * t}px ${FONTS.title}`;
    ctx.fillText('NEON STRIKE', cx, cy);

    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `${20 * t}px ${FONTS.body}`;
    ctx.fillText('霓虹突袭 · 科技飞机大战', cx, cy + 50);

    // 副标题动画
    const blink = 0.5 + 0.5 * Math.sin(this._t * 3);
    ctx.globalAlpha = t * blink;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `${18}px ${FONTS.mono}`;
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 10;
    ctx.fillText('点击或按任意键开始', cx, h * 0.62);

    ctx.globalAlpha = t;
    ctx.font = `${12}px ${FONTS.mono}`;
    ctx.fillStyle = PALETTE.text;
    ctx.globalAlpha = t * 0.5;
    ctx.fillText('© 2026 NEON STRIKE  ·  v1.0', cx, h - 40);

    ctx.restore();

    // 隐藏 DOM 加载提示
    const tip = document.getElementById('bootTip');
    if (tip && tip.style.display !== 'none') tip.style.display = 'none';
  }

  private _starCache: { x: number; y: number; r: number; s: number }[] = [];
  private _drawStarfield(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    if (this._starCache.length === 0) {
      for (let i = 0; i < 80; i++) {
        this._starCache.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.5 + 0.3,
          s: Math.random() * 30 + 10,
        });
      }
    }
    ctx.fillStyle = PALETTE.text;
    for (const s of this._starCache) {
      const y = (s.y + this._t * s.s) % h;
      ctx.globalAlpha = 0.3 + (s.r / 2) * 0.5;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private _drawGrid(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    ctx.save();
    ctx.strokeStyle = PALETTE.bgGrid;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    const gridY = (this._t * 40) % 60;
    for (let y = -60 + gridY; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.restore();
  }

  onPointerDown(): void {
    this._proceed();
  }

  onKeyDown(): void {
    this._proceed();
  }

  private _proceed(): void {
    this.game.audio.unlock();
    this.game.changeScene('menu');
  }
}
