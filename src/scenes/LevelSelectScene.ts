/**
 * 关卡选择场景
 * 8 个关卡网格卡片：已解锁可点击进入，未解锁显示锁定
 * 显示每关独立最高分；底部提供无尽模式入口与返回按钮
 */
import { Scene } from './Scene';
import type { Game } from '../game/Game';
import { Button } from '../ui/Button';
import { PALETTE, FONTS, getPlane } from '../data/config';
import { MAX_LEVEL, getLevel } from '../data/levels';
import { easeOutCubic } from '../utils/math';

/** 关卡卡片布局数据 */
interface LevelCard {
  x: number;
  y: number;
  w: number;
  h: number;
  levelId: number;
}

export class LevelSelectScene extends Scene {
  private _cards: LevelCard[] = [];
  private _buttons: Button[] = [];
  private _enterT = 0;
  private _hoverCard = -1;
  /** 悬停动画进度（按卡片索引） */
  private _hoverTs: number[] = [];

  onEnter(): void {
    super.onEnter();
    this._enterT = 0;
    this._cards = [];
    this._hoverTs = [];
    this._buildLayout();
  }

  /** 4 列 × 2 行网格卡片 + 底部按钮 */
  private _buildLayout(): void {
    const w = this.game.width;
    const h = this.game.height;
    const cols = 4;
    const cardW = 108;
    const cardH = 128;
    const gapX = 16;
    const gapY = 24;
    const startX = (w - cols * cardW - (cols - 1) * gapX) / 2;
    const startY = h * 0.28;

    for (let i = 0; i < MAX_LEVEL; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this._cards.push({
        x: startX + col * (cardW + gapX),
        y: startY + row * (cardH + gapY),
        w: cardW,
        h: cardH,
        levelId: i + 1,
      });
      this._hoverTs.push(0);
    }

    // 底部：无尽模式 + 返回主菜单
    const bw = 200;
    const bh = 48;
    const bx = (w - bw * 2 - 20) / 2;
    const by = h - 90;
    this._buttons = [
      new Button({ x: bx, y: by, w: bw, h: bh, text: '无尽模式', color: PALETTE.accent, onClick: () => this._startEndless() }),
      new Button({
        x: bx + bw + 20,
        y: by,
        w: bw,
        h: bh,
        text: '返回主菜单',
        color: PALETTE.text,
        onClick: () => this._backToMenu(),
      }),
    ];
  }

  private _startLevel(levelId: number): void {
    if (!this.game.storage.isLevelUnlocked(levelId)) return;
    this.game.audio.playSfx('click');
    this.game.changeScene('game', { level: levelId });
  }

  private _startEndless(): void {
    this.game.audio.playSfx('click');
    this.game.changeScene('game', { level: 1, endless: true });
  }

  private _backToMenu(): void {
    this.game.audio.playSfx('click');
    this.game.changeScene('menu');
  }

  update(dt: number): void {
    this._enterT = Math.min(1, this._enterT + dt * 3);
    for (const b of this._buttons) b.update(dt);
    // 悬停动画插值
    for (let i = 0; i < this._hoverTs.length; i++) {
      const target = this._hoverCard === i ? 1 : 0;
      this._hoverTs[i] += (target - this._hoverTs[i]) * Math.min(1, dt * 10);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, w, h);

    const t = easeOutCubic(this._enterT);
    ctx.save();
    ctx.globalAlpha = t;

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.primary;
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 20;
    ctx.font = `bold 38px ${FONTS.title}`;
    ctx.fillText('选择关卡', w / 2, h * 0.13);
    ctx.shadowBlur = 0;

    // 副标题：当前机型 + 累计积分
    const progress = this.game.storage.loadProgress();
    ctx.font = `14px ${FONTS.body}`;
    ctx.fillStyle = PALETTE.text;
    ctx.globalAlpha = t * 0.8;
    ctx.fillText(
      `当前出战：${getPlane(progress.selectedPlane).name}号机  ·  累计积分 ${progress.totalScore.toLocaleString()}`,
      w / 2,
      h * 0.13 + 34,
    );
    ctx.globalAlpha = t;

    // 关卡卡片
    const unlocked = progress.unlockedLevels;
    for (let i = 0; i < this._cards.length; i++) {
      this._renderCard(ctx, this._cards[i], i < unlocked, i);
    }

    // 底部按钮
    for (const b of this._buttons) b.render(ctx);

    ctx.restore();
  }

  /** 渲染单张关卡卡片 */
  private _renderCard(ctx: CanvasRenderingContext2D, card: LevelCard, unlocked: boolean, index: number): void {
    const level = getLevel(card.levelId);
    const best = this.game.storage.loadProgress().levelBestScores[String(card.levelId)] ?? 0;
    const ht = this._hoverTs[index] ?? 0;
    const cx = card.x + card.w / 2;
    const cy = card.y + card.h / 2;
    const scale = 1 + ht * 0.05;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = unlocked ? 1 : 0.45;

    // 卡片背景
    const isHover = ht > 0.01;
    ctx.shadowColor = unlocked ? PALETTE.primary : 'transparent';
    ctx.shadowBlur = isHover ? 18 * ht : 0;
    ctx.fillStyle = 'rgba(10,24,56,0.8)';
    ctx.strokeStyle = unlocked ? PALETTE.primary : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(card.x + r, card.y);
    ctx.lineTo(card.x + card.w - r, card.y);
    ctx.quadraticCurveTo(card.x + card.w, card.y, card.x + card.w, card.y + r);
    ctx.lineTo(card.x + card.w, card.y + card.h - r);
    ctx.quadraticCurveTo(card.x + card.w, card.y + card.h, card.x + card.w - r, card.y + card.h);
    ctx.lineTo(card.x + r, card.y + card.h);
    ctx.quadraticCurveTo(card.x, card.y + card.h, card.x, card.y + card.h - r);
    ctx.lineTo(card.x, card.y + r);
    ctx.quadraticCurveTo(card.x, card.y, card.x + r, card.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 内容
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!unlocked) {
      // 锁定图标
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy - 12, 9, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(cx - 12, cy - 12, 24, 18);
      ctx.strokeRect(cx - 12, cy - 12, 24, 18);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `12px ${FONTS.mono}`;
      ctx.fillText(`通关 ${card.levelId - 1} 解锁`, cx, cy + 26);
    } else {
      // 关卡号
      ctx.fillStyle = PALETTE.warning;
      ctx.shadowColor = PALETTE.warning;
      ctx.shadowBlur = 8;
      ctx.font = `bold 30px ${FONTS.title}`;
      ctx.fillText(`${card.levelId}`, cx, card.y + 30);
      ctx.shadowBlur = 0;
      // 关卡名（截断）
      ctx.fillStyle = PALETTE.text;
      ctx.font = `13px ${FONTS.body}`;
      const name = level.name.replace(/^第.关 · /, '');
      ctx.fillText(name.length > 7 ? name.slice(0, 6) + '…' : name, cx, card.y + 58);
      // 该关最高分
      ctx.fillStyle = PALETTE.primary;
      ctx.font = `11px ${FONTS.mono}`;
      ctx.fillText(best > 0 ? `最高 ${best.toLocaleString()}` : '未挑战', cx, card.y + 80);
    }
    ctx.restore();
  }

  onPointerDown(x: number, y: number): void {
    // 底部按钮优先
    for (const b of this._buttons) {
      if (b.contains(x, y)) {
        b.press();
        return;
      }
    }
    // 关卡卡片
    for (const card of this._cards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this._startLevel(card.levelId);
        return;
      }
    }
  }

  onPointerMove(x: number, y: number): void {
    for (const b of this._buttons) b.setHover(b.contains(x, y));
    this._hoverCard = -1;
    for (let i = 0; i < this._cards.length; i++) {
      const c = this._cards[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        this._hoverCard = i;
        break;
      }
    }
  }

  onKeyDown(key: string): void {
    if (key === 'escape') this._backToMenu();
  }
}
