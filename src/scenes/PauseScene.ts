/**
 * 暂停场景：覆盖在 GameScene 之上
 * 半透明遮罩 + 继续/重开/主菜单按钮
 */
import { Scene } from './Scene';
import type { Game } from '../game/Game';
import { Button } from '../ui/Button';
import { PALETTE, FONTS } from '../data/config';
import { easeOutCubic } from '../utils/math';

export class PauseScene extends Scene {
  private _buttons: Button[] = [];
  private _enterT = 0;

  onEnter(): void {
    super.onEnter();
    this._enterT = 0;
    this._buttons = [];
    const w = 240;
    const h = 50;
    const x = (this.game.width - w) / 2;
    let y = this.game.height * 0.45;
    const gap = 14;

    this._buttons.push(new Button({ x, y, w, h, text: '继续游戏', color: PALETTE.primary, onClick: () => this._resume() }));
    y += h + gap;
    this._buttons.push(new Button({ x, y, w, h, text: '重新开始', color: PALETTE.warning, onClick: () => this._restart() }));
    y += h + gap;
    this._buttons.push(new Button({ x, y, w, h, text: '返回主菜单', color: PALETTE.accent, onClick: () => this._toMenu() }));
  }

  private _resume(): void {
    this.game.audio.playSfx('click');
    // 消费残留的暂停按键，避免恢复后立即再次暂停
    this.game.input.consumePause();
    this.game.popPause();
  }

  private _restart(): void {
    this.game.audio.playSfx('click');
    // 用当前 GameScene 的关卡与机型重启：通过切换到 game 场景
    // 由于 GameScene 已在栈底，先 pop 自身，再切换
    this.game.scenes.pop();
    this.game.changeScene('game', {
      level: this._getLevel(),
      endless: this._getEndless(),
      plane: this.game.lastPlane,
    });
  }

  private _toMenu(): void {
    this.game.audio.playSfx('click');
    this.game.backToMenu();
  }

  private _getLevel(): number {
    return this.game.lastLevel;
  }

  private _getEndless(): boolean {
    return this.game.lastEndless;
  }

  update(dt: number): void {
    this._enterT = Math.min(1, this._enterT + dt * 4);
    for (const b of this._buttons) b.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    // 半透明遮罩
    ctx.fillStyle = `rgba(5,7,15,${0.7 * easeOutCubic(this._enterT)})`;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = easeOutCubic(this._enterT);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.primary;
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 20;
    ctx.font = `bold 48px ${FONTS.title}`;
    ctx.fillText('PAUSED', w / 2, h * 0.32);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `14px ${FONTS.mono}`;
    ctx.fillText('按 Esc 继续游戏', w / 2, h * 0.32 + 40);

    for (const b of this._buttons) b.render(ctx);
    ctx.restore();
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
    if (key === 'escape' || key === 'p') {
      this._resume();
    }
  }
}
