/**
 * 结算场景：显示分数、关卡、击杀
 * 进榜时输入昵称并保存到排行榜
 */
import { Scene } from './Scene';
import type { Game } from '../game/Game';
import type { SceneChangeOptions } from '../game/Game';
import { Button } from '../ui/Button';
import { PALETTE, FONTS, getPlane } from '../data/config';
import { easeOutCubic } from '../utils/math';

export class GameOverScene extends Scene {
  private _opts: SceneChangeOptions;
  private _buttons: Button[] = [];
  private _enterT = 0;
  private _highScoreChecked = false;
  private _isHighScore = false;
  private _nameEntered = false;
  private _name = 'PILOT';
  private _savedToRank = false;

  constructor(game: Game, opts: SceneChangeOptions) {
    super(game);
    this._opts = opts;
  }

  onEnter(): void {
    super.onEnter();
    this._enterT = 0;
    this._buildButtons();
    // 异步检查是否进榜
    this.game.storage.isHighScore(this._opts.score ?? 0).then((high) => {
      this._isHighScore = high;
      this._highScoreChecked = true;
    });
  }

  private _buildButtons(): void {
    this._buttons = [];
    const w = 200;
    const h = 48;
    const x = (this.game.width - w) / 2;
    let y = this.game.height - 180;
    const gap = 12;

    this._buttons.push(new Button({ x, y, w, h, text: '再玩一次', color: PALETTE.primary, onClick: () => this._retry() }));
    y += h + gap;
    this._buttons.push(new Button({ x, y, w, h, text: '返回主菜单', color: PALETTE.accent, onClick: () => this._toMenu() }));
  }

  private _retry(): void {
    this.game.audio.playSfx('click');
    // 重试当前关卡（v2：保留关卡与机型），无尽模式保持无尽
    this.game.changeScene('game', {
      level: this._opts.level ?? 1,
      endless: this._opts.endless ?? false,
      plane: this._opts.plane,
    });
  }

  private _toMenu(): void {
    this.game.audio.playSfx('click');
    this.game.backToMenu();
  }

  private _confirmName(): void {
    if (this._savedToRank) return;
    this._savedToRank = true;
    this._nameEntered = true;
    this.game.storage.addScore({
      score: this._opts.score ?? 0,
      level: this._opts.level ?? 1,
      kills: this._opts.kills ?? 0,
      player: this._name || 'PILOT',
      createdAt: Date.now(),
    });
    this.game.audio.playSfx('levelUp');
  }

  update(dt: number): void {
    this._enterT = Math.min(1, this._enterT + dt * 1.5);
    for (const b of this._buttons) b.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, w, h);
    this._drawStars(ctx);

    const t = easeOutCubic(this._enterT);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const victory = this._opts.victory;
    const cy = h * 0.22;

    // 标题
    ctx.shadowBlur = 25;
    if (victory) {
      ctx.fillStyle = PALETTE.warning;
      ctx.shadowColor = PALETTE.warning;
      ctx.font = `bold 52px ${FONTS.title}`;
      ctx.fillText('VICTORY', w / 2, cy);
      ctx.font = `16px ${FONTS.body}`;
      ctx.fillStyle = PALETTE.text;
      ctx.shadowBlur = 0;
      ctx.fillText('恭喜通关！霓虹英雄！', w / 2, cy + 44);
    } else {
      ctx.fillStyle = PALETTE.danger;
      ctx.shadowColor = PALETTE.danger;
      ctx.font = `bold 52px ${FONTS.title}`;
      ctx.fillText('GAME OVER', w / 2, cy);
      ctx.font = `16px ${FONTS.body}`;
      ctx.fillStyle = PALETTE.text;
      ctx.shadowBlur = 0;
      ctx.fillText('再接再厉，王牌飞行员', w / 2, cy + 44);
    }

    // 分数面板
    const panelY = h * 0.38;
    ctx.fillStyle = 'rgba(10,24,56,0.6)';
    ctx.strokeStyle = PALETTE.primary;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 15;
    const pw = 320;
    const ph = 180;
    const px = (w - pw) / 2;
    ctx.fillRect(px, panelY, pw, ph);
    ctx.strokeRect(px, panelY, pw, ph);
    ctx.shadowBlur = 0;

    // 分数
    ctx.fillStyle = PALETTE.text;
    ctx.font = `14px ${FONTS.mono}`;
    ctx.fillText('FINAL SCORE', w / 2, panelY + 30);
    ctx.fillStyle = PALETTE.primary;
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 12;
    ctx.font = `bold 44px ${FONTS.mono}`;
    ctx.fillText((this._opts.score ?? 0).toLocaleString(), w / 2, panelY + 68);
    ctx.shadowBlur = 0;

    // 关卡 & 击杀 & 出战机型
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONTS.body}`;
    const planeName = this._opts.plane ? getPlane(this._opts.plane).name : '';
    ctx.fillText(
      `${this._opts.endless ? '无尽模式' : '关卡 ' + this._opts.level}  |  击杀 ${this._opts.kills ?? 0}  |  ${planeName}号机`,
      w / 2,
      panelY + 110,
    );

    // v2 货币结算：本局得分累加进累计积分（解锁飞机用）
    ctx.fillStyle = PALETTE.warning;
    ctx.font = `bold 14px ${FONTS.mono}`;
    ctx.fillText(
      `积分 +${(this._opts.earnedCurrency ?? 0).toLocaleString()}  →  累计 ${(this._opts.newTotalScore ?? 0).toLocaleString()}`,
      w / 2,
      panelY + 138,
    );

    // 进榜提示
    if (this._highScoreChecked && this._isHighScore && !this._nameEntered) {
      const blink = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.globalAlpha = t * blink;
      ctx.fillStyle = PALETTE.warning;
      ctx.shadowColor = PALETTE.warning;
      ctx.shadowBlur = 12;
      ctx.font = `bold 18px ${FONTS.mono}`;
      ctx.fillText('★ 新纪录！输入名字并按回车确认 ★', w / 2, panelY + 145);
      ctx.globalAlpha = t;
      // 名字输入框
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeStyle = PALETTE.warning;
      ctx.lineWidth = 2;
      const ibw = 180;
      const ibh = 36;
      const ibx = (w - ibw) / 2;
      const iby = panelY + ph + 16;
      ctx.fillRect(ibx, iby, ibw, ibh);
      ctx.strokeRect(ibx, iby, ibw, ibh);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 20px ${FONTS.mono}`;
      ctx.textAlign = 'center';
      const cursor = Math.floor(performance.now() / 500) % 2 === 0 ? '_' : ' ';
      ctx.fillText(this._name + cursor, w / 2, iby + ibh / 2 + 1);
    } else if (this._nameEntered) {
      ctx.fillStyle = PALETTE.green;
      ctx.font = `bold 16px ${FONTS.mono}`;
      ctx.fillText(`已记入排行榜: ${this._name}`, w / 2, panelY + 145);
    }

    // 按钮
    for (const b of this._buttons) b.render(ctx);

    ctx.restore();
  }

  private _stars: { x: number; y: number; r: number; a: number }[] = [];
  private _drawStars(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    if (this._stars.length === 0) {
      for (let i = 0; i < 60; i++) {
        this._stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.3, a: 0.2 + Math.random() * 0.4 });
      }
    }
    ctx.fillStyle = PALETTE.text;
    for (const s of this._stars) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  onPointerDown(x: number, y: number): void {
    for (const b of this._buttons) {
      if (b.contains(x, y)) {
        b.press();
        return;
      }
    }
  }

  onPointerMove(x: number, y: number): void {
    for (const b of this._buttons) b.setHover(b.contains(x, y));
  }

  onKeyDown(key: string): void {
    // 名字输入模式
    if (this._highScoreChecked && this._isHighScore && !this._nameEntered) {
      if (key === 'enter') {
        this._confirmName();
        return;
      }
      if (key === 'backspace') {
        this._name = this._name.slice(0, -1);
        return;
      }
      // 限制为可打印字符，最长 8
      if (key.length === 1 && this._name.length < 8 && /[a-zA-Z0-9 _\-]/.test(key)) {
        this._name += key.toUpperCase();
      }
      return;
    }
    if (key === 'enter' || key === ' ') {
      this._retry();
    }
  }
}
