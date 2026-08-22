/**
 * HUD：抬头显示
 * 血量、分数、武器等级、炸弹、关卡、连击
 */
import { PALETTE, FONTS } from '../data/config';
import type { Player } from '../entities/Player';

export class HUD {
  private _score = 0;
  private _displayScore = 0; // 滚动数字
  private _level = 1;
  private _endless = false;
  private _combo = 0;
  private _comboTimer = 0;
  private _levelTime = 0;
  private _bossActive = false;
  private _shake = 0;

  setScore(v: number): void {
    this._score = v;
  }
  setLevel(v: number, endless: boolean): void {
    this._level = v;
    this._endless = endless;
  }
  setCombo(v: number): void {
    this._combo = v;
    this._comboTimer = 2;
  }
  setLevelTime(v: number): void {
    this._levelTime = v;
  }
  setBossActive(v: boolean): void {
    this._bossActive = v;
  }
  shake(intensity: number): void {
    this._shake = Math.max(this._shake, intensity);
  }

  update(dt: number): void {
    // 分数滚动
    this._displayScore += (this._score - this._displayScore) * Math.min(1, dt * 8);
    if (Math.abs(this._displayScore - this._score) < 1) this._displayScore = this._score;
    if (this._comboTimer > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer <= 0) this._combo = 0;
    }
    if (this._shake > 0) this._shake = Math.max(0, this._shake - dt * 30);
  }

  render(ctx: CanvasRenderingContext2D, player: Player, w: number, h: number): void {
    ctx.save();
    // 屏幕震动
    if (this._shake > 0) {
      ctx.translate((Math.random() - 0.5) * this._shake, (Math.random() - 0.5) * this._shake);
    }

    // 左上：血量
    this._renderHp(ctx, player);
    // 右上：分数
    this._renderScore(ctx, w);
    // 左下：武器等级 + 炸弹
    this._renderWeapon(ctx, player, h);
    // 右下：关卡信息
    this._renderLevel(ctx, w, h);
    // 中上：连击
    if (this._combo > 1) this._renderCombo(ctx, w);

    ctx.restore();
  }

  private _renderHp(ctx: CanvasRenderingContext2D, player: Player): void {
    const x = 16;
    const y = 16;
    ctx.font = `bold 12px ${FONTS.mono}`;
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('HULL', x, y);
    // 能量条
    const barW = 120;
    const barH = 10;
    const bx = x;
    const by = y + 16;
    ctx.fillStyle = 'rgba(10,24,56,0.8)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.strokeStyle = PALETTE.danger;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);
    // 分段
    const segW = barW / player.maxHp;
    for (let i = 0; i < player.hp; i++) {
      ctx.fillStyle = PALETTE.danger;
      ctx.shadowColor = PALETTE.danger;
      ctx.shadowBlur = 8;
      ctx.fillRect(bx + i * segW + 1, by + 1, segW - 2, barH - 2);
    }
    ctx.shadowBlur = 0;
    // 护盾指示
    if (player.hasShield) {
      ctx.fillStyle = PALETTE.primary;
      ctx.font = `bold 11px ${FONTS.mono}`;
      ctx.fillText('◈ SHIELD', x, by + barH + 4);
    }
  }

  private _renderScore(ctx: CanvasRenderingContext2D, w: number): void {
    const x = w - 16;
    const y = 16;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 11px ${FONTS.mono}`;
    ctx.fillText('SCORE', x, y);
    ctx.fillStyle = PALETTE.primary;
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 10;
    ctx.font = `bold 26px ${FONTS.mono}`;
    ctx.fillText(Math.floor(this._displayScore).toString().padStart(6, '0'), x, y + 14);
    ctx.shadowBlur = 0;
  }

  private _renderWeapon(ctx: CanvasRenderingContext2D, player: Player, h: number): void {
    const x = 16;
    const y = h - 50;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // 武器等级
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 11px ${FONTS.mono}`;
    ctx.fillText('WEAPON', x, y);
    const dots = 5;
    const dotR = 6;
    for (let i = 0; i < dots; i++) {
      ctx.beginPath();
      ctx.arc(x + 8 + i * 16, y + 22, dotR, 0, Math.PI * 2);
      if (i < player.weaponLevel) {
        ctx.fillStyle = PALETTE.accent;
        ctx.shadowColor = PALETTE.accent;
        ctx.shadowBlur = 8;
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.shadowBlur = 0;
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    // 炸弹
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 11px ${FONTS.mono}`;
    ctx.fillText(`BOMB × ${player.bombs}`, x, y + 34);
  }

  private _renderLevel(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const x = w - 16;
    const y = h - 50;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 11px ${FONTS.mono}`;
    if (this._endless) {
      ctx.fillText('ENDLESS', x, y);
      const min = Math.floor(this._levelTime / 60);
      const sec = Math.floor(this._levelTime % 60);
      ctx.fillStyle = PALETTE.accent;
      ctx.font = `bold 18px ${FONTS.mono}`;
      ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, x, y + 14);
    } else {
      ctx.fillText(`LEVEL ${this._level}`, x, y);
      if (!this._bossActive) {
        const remaining = Math.max(0, this._levelTime);
        ctx.fillStyle = PALETTE.warning;
        ctx.font = `bold 16px ${FONTS.mono}`;
        ctx.fillText(`${Math.ceil(remaining)}s`, x, y + 14);
      } else {
        ctx.fillStyle = PALETTE.danger;
        ctx.font = `bold 14px ${FONTS.mono}`;
        ctx.fillText('BOSS!', x, y + 14);
      }
    }
  }

  private _renderCombo(ctx: CanvasRenderingContext2D, w: number): void {
    const x = w / 2;
    const y = 70;
    const t = this._comboTimer / 2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = 1 + (1 - t) * 0.3;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = PALETTE.warning;
    ctx.shadowColor = PALETTE.warning;
    ctx.shadowBlur = 12;
    ctx.font = `bold 28px ${FONTS.mono}`;
    ctx.fillText(`${this._combo} COMBO`, 0, 0);
    ctx.restore();
  }
}
