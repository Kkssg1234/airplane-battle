/**
 * Game 游戏主类：中央枢纽
 * 管理 Canvas、时间、循环、场景、各全局系统
 * 提供场景切换便捷方法
 */
import { TimeManager } from './TimeManager';
import { GameLoop } from './GameLoop';
import { SceneManager } from '../scenes/SceneManager';
import { InputManager } from '../systems/InputManager';
import { StorageManager } from '../data/StorageManager';
import { AudioManager } from '../systems/AudioManager';
import { DESIGN_WIDTH, DESIGN_HEIGHT, PALETTE } from '../data/config';
import type { SceneId, UserConfig } from '../types';

// 场景类延迟引用（运行时实例化，规避循环依赖）
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { GameScene } from '../scenes/GameScene';
import { PauseScene } from '../scenes/PauseScene';
import { GameOverScene } from '../scenes/GameOverScene';

export interface SceneChangeOptions {
  level?: number;
  endless?: boolean;
  score?: number;
  kills?: number;
  victory?: boolean;
  noDamage?: boolean;
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = DESIGN_WIDTH;
  height = DESIGN_HEIGHT;

  time: TimeManager;
  loop: GameLoop;
  scenes: SceneManager;
  input: InputManager;
  storage: StorageManager;
  audio: AudioManager;

  config: UserConfig;
  private _running = false;

  /** 当前游戏关卡信息（供暂停重启使用） */
  lastLevel = 1;
  lastEndless = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = DESIGN_WIDTH;
    canvas.height = DESIGN_HEIGHT;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context 不可用');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = true;

    this.time = new TimeManager();
    this.scenes = new SceneManager();
    this.storage = new StorageManager();
    this.config = this.storage.loadConfig();
    this.input = new InputManager(canvas);
    this.input.setScheme(this.config.controlScheme);
    this.audio = new AudioManager(this.config);

    this.loop = new GameLoop(
      this.time,
      (dt) => this.scenes.update(dt),
      () => this.scenes.render(this.ctx),
    );

    this._setupCanvasResize();
    this._setupInputForward();
  }

  async start(): Promise<void> {
    if (this._running) return;
    await this.storage.init();
    // 启动场景
    this.scenes.switch(new BootScene(this));
    this.loop.start();
    this._running = true;
  }

  get running(): boolean {
    return this._running;
  }

  /** 切换/替换栈底场景 */
  changeScene(id: SceneId, opts: SceneChangeOptions = {}): void {
    switch (id) {
      case 'boot':
        this.scenes.switch(new BootScene(this));
        break;
      case 'menu':
        this.scenes.switch(new MenuScene(this));
        break;
      case 'game':
        this.lastLevel = opts.level ?? 1;
        this.lastEndless = opts.endless ?? false;
        this.scenes.switch(new GameScene(this, this.lastLevel, this.lastEndless));
        break;
      case 'gameover':
        this.scenes.switch(new GameOverScene(this, opts));
        break;
      case 'pause':
        this.scenes.push(new PauseScene(this));
        break;
    }
  }

  /** 暂停覆盖（不替换） */
  pushPause(): void {
    this.scenes.push(new PauseScene(this));
  }

  popPause(): void {
    this.scenes.pop();
  }

  /** 返回菜单 */
  backToMenu(): void {
    this.audio.stopBgm();
    this.changeScene('menu');
  }

  /** 更新配置并持久化 */
  updateConfig(cfg: UserConfig): void {
    this.config = cfg;
    this.input.setScheme(cfg.controlScheme);
    this.audio.setConfig(cfg);
    this.storage.saveConfig(cfg);
  }

  /** 适配窗口大小：保持竖屏比例，CSS 缩放 */
  private _setupCanvasResize(): void {
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // 设计分辨率固定，CSS 缩放保证比例
      const scale = Math.min(
        window.innerWidth / DESIGN_WIDTH,
        window.innerHeight / DESIGN_HEIGHT,
      );
      this.canvas.style.width = `${DESIGN_WIDTH * scale}px`;
      this.canvas.style.height = `${DESIGN_HEIGHT * scale}px`;
      // 内部分辨率使用设计尺寸，保证逻辑一致
      this.canvas.width = DESIGN_WIDTH * dpr;
      this.canvas.height = DESIGN_HEIGHT * dpr;
      this.width = DESIGN_WIDTH;
      this.height = DESIGN_HEIGHT;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
  }

  /** 清屏（背景） */
  clear(): void {
    this.ctx.fillStyle = PALETTE.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /** 将原始屏幕坐标转为设计分辨率坐标 */
  private _toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * DESIGN_WIDTH,
      y: ((clientY - rect.top) / rect.height) * DESIGN_HEIGHT,
    };
  }

  /** 输入事件转发给当前场景（场景 UI 用） */
  private _setupInputForward(): void {
    // 键盘
    window.addEventListener('keydown', (e) => {
      this.scenes.dispatchKeyDown(this._normKey(e.key));
    });
    window.addEventListener('keyup', (e) => {
      this.scenes.dispatchKeyUp(this._normKey(e.key));
    });
    // 鼠标
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const p = this._toLogical(e.clientX, e.clientY);
      this.scenes.dispatchPointerDown(p.x, p.y);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const p = this._toLogical(e.clientX, e.clientY);
      this.scenes.dispatchPointerMove(p.x, p.y);
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      const p = this._toLogical(e.clientX, e.clientY);
      this.scenes.dispatchPointerUp(p.x, p.y);
    });
    // 触摸
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 1) return; // 多指交给 InputManager 处理炸弹
        const t = e.touches[0];
        if (!t) return;
        const p = this._toLogical(t.clientX, t.clientY);
        this.scenes.dispatchPointerDown(p.x, p.y);
      },
      { passive: true },
    );
    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        const t = e.touches[0];
        if (!t) return;
        const p = this._toLogical(t.clientX, t.clientY);
        this.scenes.dispatchPointerMove(p.x, p.y);
      },
      { passive: true },
    );
    this.canvas.addEventListener(
      'touchend',
      (e) => {
        const t = e.changedTouches[0];
        if (!t) return;
        const p = this._toLogical(t.clientX, t.clientY);
        this.scenes.dispatchPointerUp(p.x, p.y);
      },
      { passive: true },
    );
  }

  private _normKey(key: string): string {
    return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
  }
}
