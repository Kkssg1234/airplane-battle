/**
 * 主菜单场景：开始游戏、无尽模式、排行榜、成就、设置
 * 内含多个子面板切换
 */
import { Scene } from './Scene';
import type { Game } from '../game/Game';
import { Button } from '../ui/Button';
import { PALETTE, FONTS, ACHIEVEMENTS, getPlane } from '../data/config';
import type { ScoreRecord } from '../types';
import { easeOutCubic } from '../utils/math';

type Panel = 'main' | 'ranks' | 'achievements' | 'settings';

export class MenuScene extends Scene {
  private _buttons: Button[] = [];
  private _panel: Panel = 'main';
  private _enterT = 0;
  private _t = 0;
  private _scores: ScoreRecord[] = [];
  private _loadingScores = false;

  onEnter(): void {
    super.onEnter();
    this._enterT = 0;
    this._buildMainButtons();
  }

  onExit(): void {
    super.onExit();
    this._buttons = [];
  }

  private _buildMainButtons(): void {
    this._buttons = [];
    const w = 280;
    const h = 52;
    const x = (this.game.width - w) / 2;
    let y = this.game.height * 0.35;
    const gap = 12;

    const progress = this.game.storage.loadProgress();
    const startLabel = progress.highestLevel > 1 ? `继续游戏 (关卡 ${progress.highestLevel})` : '开始游戏';

    this._buttons.push(new Button({ x, y, w, h, text: startLabel, color: PALETTE.primary, onClick: () => this._startGame(progress.highestLevel) }));
    y += h + gap;
    // v2：关卡选择（自由选关）与机库（飞机选择/解锁）
    this._buttons.push(new Button({ x, y, w, h, text: '关卡选择', color: PALETTE.accent, onClick: () => this._toLevelSelect() }));
    y += h + gap;
    this._buttons.push(new Button({ x, y, w, h, text: '机库', color: PALETTE.green, onClick: () => this._toPlaneSelect() }));
    y += h + gap;
    this._buttons.push(new Button({ x, y, w, h, text: '无尽模式', color: PALETTE.accent, onClick: () => this._startEndless() }));
    y += h + gap;
    this._buttons.push(new Button({ x, y, w, h, text: '排行榜', color: PALETTE.warning, onClick: () => this._showPanel('ranks') }));
    y += h + gap;
    this._buttons.push(new Button({ x, y, w, h, text: '成就', color: PALETTE.green, onClick: () => this._showPanel('achievements') }));
    y += h + gap;
    this._buttons.push(new Button({ x, y, w, h, text: '设置', color: PALETTE.purple, onClick: () => this._showPanel('settings') }));
  }

  /** 进入关卡选择界面（自由选择已解锁关卡） */
  private _toLevelSelect(): void {
    this.game.audio.playSfx('click');
    this.game.changeScene('levelSelect');
  }

  /** 进入机库（飞机选择/解锁） */
  private _toPlaneSelect(): void {
    this.game.audio.playSfx('click');
    this.game.changeScene('planeSelect');
  }

  private _startGame(level: number): void {
    this.game.audio.playSfx('click');
    this.game.changeScene('game', { level });
  }

  private _startEndless(): void {
    this.game.audio.playSfx('click');
    this.game.changeScene('game', { level: 1, endless: true });
  }

  private _showPanel(p: Panel): void {
    this.game.audio.playSfx('click');
    this._panel = p;
    this._buttons = [];
    const w = 200;
    const h = 46;
    const x = (this.game.width - w) / 2;
    const y = this.game.height - 80;
    this._buttons.push(new Button({ x, y, w, h, text: '返回主菜单', color: PALETTE.text, onClick: () => this._backToMain() }));

    if (p === 'ranks' && !this._loadingScores) {
      this._loadingScores = true;
      this.game.storage.getScores().then((s) => {
        this._scores = s;
        this._loadingScores = false;
      });
    }
  }

  private _backToMain(): void {
    this.game.audio.playSfx('click');
    this._panel = 'main';
    this._buildMainButtons();
  }

  update(dt: number): void {
    this._t += dt;
    this._enterT = Math.min(1, this._enterT + dt * 2);
    for (const b of this._buttons) b.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, w, h);
    this._drawBackground(ctx);

    const t = easeOutCubic(this._enterT);
    ctx.save();
    ctx.globalAlpha = t;

    // 顶部标题
    if (this._panel === 'main') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = PALETTE.primary;
      ctx.shadowBlur = 25;
      ctx.fillStyle = PALETTE.primary;
      ctx.font = `bold 44px ${FONTS.title}`;
      ctx.fillText('NEON STRIKE', w / 2, h * 0.16);
      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.accent;
      ctx.font = `16px ${FONTS.body}`;
      ctx.fillText('霓虹突袭', w / 2, h * 0.16 + 36);

      // 操作提示
      ctx.fillStyle = PALETTE.text;
      ctx.globalAlpha = t * 0.6;
      ctx.font = `13px ${FONTS.mono}`;
      ctx.fillText('方向键/WASD 移动 · Shift 慢速 · 空格/Z 射击 · X 炸弹 · C 技能 · Esc 暂停', w / 2, h * 0.28);
      ctx.globalAlpha = t;
    }

    // 按钮渲染（主面板）
    if (this._panel === 'main') {
      for (const b of this._buttons) b.render(ctx);
    } else {
      // 子面板内容
      this._renderPanel(ctx);
      // 返回按钮
      for (const b of this._buttons) b.render(ctx);
    }

    ctx.restore();
  }

  private _renderPanel(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    ctx.save();

    // 面板标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 15;
    ctx.fillStyle = PALETTE.primary;
    const titles: Record<Panel, string> = { main: '', ranks: '排 行 榜', achievements: '成 就', settings: '设 置' };
    ctx.font = `bold 36px ${FONTS.title}`;
    ctx.fillText(titles[this._panel], w / 2, 100);
    ctx.shadowBlur = 0;

    if (this._panel === 'ranks') this._renderRanks(ctx);
    else if (this._panel === 'achievements') this._renderAchievements(ctx);
    else if (this._panel === 'settings') this._renderSettings(ctx);

    ctx.restore();
  }

  private _renderRanks(ctx: CanvasRenderingContext2D): void {
    const { width: w } = this.game;
    const list = this._scores;
    const startY = 170;
    const rowH = 42;

    ctx.textAlign = 'center';
    ctx.font = `14px ${FONTS.mono}`;
    ctx.fillStyle = PALETTE.text;
    ctx.globalAlpha = 0.6;
    ctx.fillText('排名        玩家            分数          关卡', w / 2, startY - 26);
    ctx.globalAlpha = 1;

    if (list.length === 0) {
      ctx.fillStyle = PALETTE.text;
      ctx.globalAlpha = 0.5;
      ctx.font = `16px ${FONTS.body}`;
      ctx.fillText('暂无记录，快去创造第一个传奇吧！', w / 2, startY + 80);
      return;
    }

    list.slice(0, 10).forEach((r, i) => {
      const y = startY + i * rowH;
      // 行背景
      if (i < 3) {
        const colors = [PALETTE.warning, '#C0C0C0', '#CD7F32'];
        ctx.fillStyle = colors[i];
        ctx.globalAlpha = 0.12;
        ctx.fillRect(40, y - rowH / 2 + 4, w - 80, rowH - 8);
        ctx.globalAlpha = 1;
      }
      ctx.font = `16px ${FONTS.mono}`;
      ctx.fillStyle = i < 3 ? [PALETTE.warning, '#E0E0E0', '#CD7F32'][i] : PALETTE.text;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}`, 70, y);
      ctx.fillText(r.player.slice(0, 8), 140, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.primary;
      ctx.fillText(r.score.toLocaleString(), w - 130, y);
      ctx.fillStyle = PALETTE.accent;
      ctx.fillText(`Lv.${r.level}`, w - 70, y);
    });
  }

  private _renderAchievements(ctx: CanvasRenderingContext2D): void {
    const { width: w } = this.game;
    const progress = this.game.storage.loadProgress();
    const unlocked = new Set(progress.unlockedAchievements);
    const startY = 170;
    const rowH = 52;

    ACHIEVEMENTS.forEach((a, i) => {
      const y = startY + i * rowH;
      const isUnlocked = unlocked.has(a.id);
      ctx.globalAlpha = isUnlocked ? 1 : 0.4;

      // 图标
      ctx.fillStyle = isUnlocked ? PALETTE.warning : PALETTE.text;
      ctx.shadowColor = isUnlocked ? PALETTE.warning : 'transparent';
      ctx.shadowBlur = isUnlocked ? 10 : 0;
      ctx.beginPath();
      ctx.arc(80, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.bg;
      ctx.font = `bold 14px ${FONTS.mono}`;
      ctx.textAlign = 'center';
      ctx.fillText(isUnlocked ? '★' : '?', 80, y + 1);

      // 文字
      ctx.textAlign = 'left';
      ctx.fillStyle = isUnlocked ? PALETTE.primary : PALETTE.text;
      ctx.font = `bold 17px ${FONTS.body}`;
      ctx.fillText(a.name, 110, y - 8);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `13px ${FONTS.body}`;
      ctx.fillText(a.desc, 110, y + 12);
      ctx.globalAlpha = 1;
    });
  }

  private _renderSettings(ctx: CanvasRenderingContext2D): void {
    const { width: w } = this.game;
    const cfg = this.game.config;
    const startY = 180;
    const rowH = 60;

    const rows: { label: string; value: string; key: string }[] = [
      { label: '音效', value: cfg.soundEnabled ? '开启' : '关闭', key: 'sound' },
      { label: '背景音乐', value: cfg.musicEnabled ? '开启' : '关闭', key: 'music' },
      { label: '控制方式', value: { keyboard: '键盘', mouse: '鼠标', touch: '触摸' }[cfg.controlScheme], key: 'control' },
      { label: '画质', value: { low: '低', medium: '中', high: '高' }[cfg.quality], key: 'quality' },
    ];

    rows.forEach((r, i) => {
      const y = startY + i * rowH;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `18px ${FONTS.body}`;
      ctx.fillText(r.label, 80, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.primary;
      ctx.font = `bold 18px ${FONTS.mono}`;
      ctx.fillText(r.value + '  ▶', w - 80, y);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.globalAlpha = 0.5;
    ctx.font = `13px ${FONTS.mono}`;
    ctx.fillText('点击右侧数值可切换设置', w / 2, startY + rows.length * rowH + 20);
    ctx.globalAlpha = 1;
  }

  // 背景星空 + 网格
  private _stars: { x: number; y: number; r: number; s: number }[] = [];
  private _drawBackground(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    if (this._stars.length === 0) {
      for (let i = 0; i < 60; i++) {
        this._stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.3, s: Math.random() * 25 + 8 });
      }
    }
    ctx.fillStyle = PALETTE.text;
    for (const s of this._stars) {
      const y = (s.y + this._t * s.s) % h;
      ctx.globalAlpha = 0.2 + (s.r / 1.5) * 0.4;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = PALETTE.bgGrid;
    ctx.lineWidth = 1;
    const gy = (this._t * 30) % 60;
    for (let y = -60 + gy; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  onPointerDown(x: number, y: number): void {
    // 按钮
    for (const b of this._buttons) {
      if (b.contains(x, y)) {
        b.press();
        return;
      }
    }
    // 设置项点击切换
    if (this._panel === 'settings') {
      this._handleSettingsClick(x, y);
    }
  }

  onPointerMove(x: number, y: number): void {
    for (const b of this._buttons) b.setHover(b.contains(x, y));
  }

  private _handleSettingsClick(x: number, y: number): void {
    const { width: w } = this.game;
    if (x < w / 2) return; // 只响应右半区
    const startY = 180;
    const rowH = 60;
    const idx = Math.floor((y - startY + rowH / 2) / rowH);
    if (idx < 0 || idx > 3) return;
    const cfg = { ...this.game.config };
    switch (idx) {
      case 0:
        cfg.soundEnabled = !cfg.soundEnabled;
        break;
      case 1:
        cfg.musicEnabled = !cfg.musicEnabled;
        if (!cfg.musicEnabled) this.game.audio.stopBgm();
        break;
      case 2:
        cfg.controlScheme = cfg.controlScheme === 'keyboard' ? 'mouse' : cfg.controlScheme === 'mouse' ? 'touch' : 'keyboard';
        break;
      case 3:
        cfg.quality = cfg.quality === 'low' ? 'medium' : cfg.quality === 'medium' ? 'high' : 'low';
        break;
    }
    this.game.updateConfig(cfg);
    this.game.audio.playSfx('click');
  }

  onKeyDown(key: string): void {
    if (key === 'escape' && this._panel !== 'main') {
      this._backToMain();
    } else if (key === 'escape' && this._panel === 'main') {
      // 主菜单 esc 无操作
    }
  }
}
