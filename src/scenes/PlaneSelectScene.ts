/**
 * 机库场景（飞机选择）
 * 4 张飞机卡片：属性雷达条、技能说明、解锁状态
 * 已解锁机型点击选择出战；未解锁且积分足够时二次点击确认解锁（防误触）
 */
import { Scene } from './Scene';
import type { Game } from '../game/Game';
import { Button } from '../ui/Button';
import { PALETTE, FONTS, PLANES } from '../data/config';
import type { PlaneDef } from '../data/config';
import { easeOutCubic } from '../utils/math';

/** 飞机卡片布局数据 */
interface PlaneCard {
  x: number;
  y: number;
  w: number;
  h: number;
  def: PlaneDef;
}

export class PlaneSelectScene extends Scene {
  private _cards: PlaneCard[] = [];
  private _buttons: Button[] = [];
  private _enterT = 0;
  private _hoverCard = -1;
  private _hoverTs: number[] = [];
  /** 待二次确认解锁的机型 ID（点击一次后进入确认状态） */
  private _pendingUnlock: string | null = null;
  private _pendingUnlockT = 0;

  onEnter(): void {
    super.onEnter();
    this._enterT = 0;
    this._pendingUnlock = null;
    this._buildLayout();
  }

  private _buildLayout(): void {
    const w = this.game.width;
    const h = this.game.height;
    // 2 列 × 2 行
    const cardW = 230;
    const cardH = 240;
    const gapX = 24;
    const gapY = 24;
    const startX = (w - cardW * 2 - gapX) / 2;
    const startY = h * 0.2;

    this._cards = [];
    this._hoverTs = [];
    for (let i = 0; i < PLANES.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      this._cards.push({
        x: startX + col * (cardW + gapX),
        y: startY + row * (cardH + gapY),
        w: cardW,
        h: cardH,
        def: PLANES[i],
      });
      this._hoverTs.push(0);
    }

    const bw = 200;
    const bh = 46;
    this._buttons = [
      new Button({
        x: (w - bw) / 2,
        y: h - 66,
        w: bw,
        h: bh,
        text: '返回主菜单',
        color: PALETTE.text,
        onClick: () => this._backToMenu(),
      }),
    ];
  }

  private _backToMenu(): void {
    this.game.audio.playSfx('click');
    this.game.changeScene('menu');
  }

  /** 点击卡片：已解锁→选中；未解锁→首次点击进入确认，再次点击解锁 */
  private _clickCard(def: PlaneDef): void {
    const storage = this.game.storage;
    const unlocked = storage.loadProgress().unlockedPlanes.includes(def.id);
    if (unlocked) {
      storage.selectPlane(def.id);
      this.game.audio.playSfx('levelUp');
      this._pendingUnlock = null;
      return;
    }
    // 未解锁：积分足够 → 二次确认解锁
    const progress = storage.loadProgress();
    if (progress.totalScore >= def.unlockScore) {
      if (this._pendingUnlock === def.id) {
        // 第二次点击：确认解锁
        if (storage.unlockPlane(def.id, def.unlockScore)) {
          storage.selectPlane(def.id);
          this.game.audio.playSfx('levelUp');
        }
        this._pendingUnlock = null;
      } else {
        // 第一次点击：进入确认状态
        this._pendingUnlock = def.id;
        this._pendingUnlockT = 0;
        this.game.audio.playSfx('click');
      }
    } else {
      this.game.audio.playSfx('click');
    }
  }

  update(dt: number): void {
    this._enterT = Math.min(1, this._enterT + dt * 3);
    for (const b of this._buttons) b.update(dt);
    for (let i = 0; i < this._hoverTs.length; i++) {
      const target = this._hoverCard === i ? 1 : 0;
      this._hoverTs[i] += (target - this._hoverTs[i]) * Math.min(1, dt * 10);
    }
    if (this._pendingUnlock) {
      this._pendingUnlockT += dt;
      // 5 秒未确认自动取消
      if (this._pendingUnlockT > 5) this._pendingUnlock = null;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, w, h);

    const t = easeOutCubic(this._enterT);
    ctx.save();
    ctx.globalAlpha = t;

    // 标题 + 积分余额
    const progress = this.game.storage.loadProgress();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.primary;
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 20;
    ctx.font = `bold 38px ${FONTS.title}`;
    ctx.fillText('机 库', w / 2, h * 0.1);
    ctx.shadowBlur = 0;
    ctx.font = `14px ${FONTS.body}`;
    ctx.fillStyle = PALETTE.warning;
    ctx.fillText(`累计积分 ${progress.totalScore.toLocaleString()}（每局得分自动累积）`, w / 2, h * 0.1 + 34);

    // 卡片
    for (let i = 0; i < this._cards.length; i++) {
      this._renderCard(ctx, this._cards[i], i);
    }

    // 底部按钮
    for (const b of this._buttons) b.render(ctx);

    ctx.restore();
  }

  /** 渲染单张飞机卡片 */
  private _renderCard(ctx: CanvasRenderingContext2D, card: PlaneCard, index: number): void {
    const def = card.def;
    const progress = this.game.storage.loadProgress();
    const unlocked = progress.unlockedPlanes.includes(def.id);
    const selected = progress.selectedPlane === def.id;
    const affordable = progress.totalScore >= def.unlockScore;
    const ht = this._hoverTs[index] ?? 0;
    const cx = card.x + card.w / 2;
    const cy = card.y + card.h / 2;
    const scale = 1 + ht * 0.03;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // 卡片背景（选中态描边加粗高亮）
    ctx.fillStyle = 'rgba(10,24,56,0.85)';
    ctx.strokeStyle = selected ? PALETTE.warning : unlocked ? def.color : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = selected ? 3 : 2;
    if (selected || ht > 0.01) {
      ctx.shadowColor = selected ? PALETTE.warning : def.color;
      ctx.shadowBlur = 16 * (selected ? 0.8 : ht);
    }
    const r = 12;
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

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = unlocked ? 1 : 0.75;

    // 机型名
    ctx.fillStyle = unlocked ? def.color : 'rgba(255,255,255,0.5)';
    ctx.font = `bold 24px ${FONTS.body}`;
    ctx.fillText(def.name, cx, card.y + 30);

    // 描述
    ctx.fillStyle = PALETTE.text;
    ctx.font = `12px ${FONTS.body}`;
    ctx.fillText(def.desc, cx, card.y + 54);

    // 属性条（速度/火力/生命 归一化展示）
    const attrs = [
      { label: '速度', value: Math.min(1, def.speed / 480) },
      { label: '火力', value: Math.min(1, (def.fireRateMult * def.damageMult) / 2) },
      { label: '生命', value: Math.min(1, def.maxHp / 6) },
    ];
    const barX = card.x + 34;
    const barW = card.w - 68 - 44;
    attrs.forEach((a, i) => {
      const y = card.y + 82 + i * 22;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `11px ${FONTS.mono}`;
      ctx.fillText(a.label, barX - 6, y);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(barX + 34, y - 5, barW, 10);
      ctx.fillStyle = def.color;
      ctx.fillRect(barX + 34, y - 5, barW * a.value, 10);
    });

    // 技能说明
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.green;
    ctx.font = `bold 12px ${FONTS.mono}`;
    ctx.fillText(`技能: ${def.skill.name} (CD ${def.skill.cooldown}s)`, cx, card.y + 152);
    ctx.fillStyle = PALETTE.text;
    ctx.globalAlpha = 0.8;
    ctx.font = `11px ${FONTS.body}`;
    ctx.fillText(def.skill.desc, cx, card.y + 170);
    ctx.globalAlpha = unlocked ? 1 : 0.75;

    // 底部状态行
    if (unlocked) {
      if (selected) {
        ctx.fillStyle = PALETTE.warning;
        ctx.font = `bold 14px ${FONTS.mono}`;
        ctx.fillText('★ 当前出战', cx, card.y + 196);
      } else {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `13px ${FONTS.body}`;
        ctx.fillText('点击选择出战', cx, card.y + 196);
      }
    } else if (affordable) {
      // 可解锁：二次确认状态闪烁
      const confirming = this._pendingUnlock === def.id;
      const blink = confirming ? 0.5 + 0.5 * Math.sin(performance.now() / 150) : 1;
      ctx.globalAlpha = blink;
      ctx.fillStyle = confirming ? PALETTE.danger : PALETTE.green;
      ctx.font = `bold 13px ${FONTS.mono}`;
      ctx.fillText(confirming ? `再点一次确认解锁 (${def.unlockScore.toLocaleString()})` : `解锁 ${def.unlockScore.toLocaleString()}`, cx, card.y + 196);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = `13px ${FONTS.mono}`;
      ctx.fillText(`需积分 ${def.unlockScore.toLocaleString()}`, cx, card.y + 196);
    }

    ctx.restore();
  }

  onPointerDown(x: number, y: number): void {
    for (const b of this._buttons) {
      if (b.contains(x, y)) {
        b.press();
        return;
      }
    }
    for (const card of this._cards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this._clickCard(card.def);
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
