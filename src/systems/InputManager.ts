/**
 * 输入管理：统一键盘/鼠标/触摸输入
 * 暴露语义化接口供场景使用
 */
import type { ControlScheme } from '../types';

export class InputManager {
  private _keys = new Set<string>();
  private _pointer = { x: 0, y: 0, down: false };
  private _scheme: ControlScheme = 'keyboard';
  private _canvas: HTMLCanvasElement;

  // 消费型事件（一次性）
  private _bombPressed = false;
  private _pausePressed = false;
  private _weaponSwitchPressed = false;

  /** 双指触摸检测炸弹 */
  private _touchCount = 0;
  private _lastTwoFingerTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._bindEvents();
  }

  setScheme(scheme: ControlScheme): void {
    this._scheme = scheme;
  }

  get scheme(): ControlScheme {
    return this._scheme;
  }

  private _bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      const k = this._normalizeKey(e.key);
      this._keys.add(k);
      if (k === 'x') this._bombPressed = true;
      if (k === 'escape' || k === 'p') this._pausePressed = true;
      if (k === 'c') this._weaponSwitchPressed = true;
      // 阻止方向键/空格滚动页面
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'x', 'z'].includes(k)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this._keys.delete(this._normalizeKey(e.key));
    });

    // 鼠标
    this._canvas.addEventListener('mousemove', (e) => {
      const rect = this._canvas.getBoundingClientRect();
      this._pointer.x = (e.clientX - rect.left) * (this._canvas.width / rect.width);
      this._pointer.y = (e.clientY - rect.top) * (this._canvas.height / rect.height);
      this._pointer.down = (e.buttons & 1) === 1;
    });
    this._canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this._pointer.down = true;
    });
    this._canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._pointer.down = false;
    });

    // 触摸
    this._canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this._touchCount = e.touches.length;
        if (e.touches.length >= 2) {
          this._bombPressed = true;
          this._lastTwoFingerTime = performance.now();
        }
        const t = e.touches[0];
        if (t) this._updateTouch(t);
        this._pointer.down = true;
      },
      { passive: false },
    );
    this._canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        const t = e.touches[0];
        if (t) this._updateTouch(t);
      },
      { passive: false },
    );
    this._canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._touchCount = e.touches.length;
      if (e.touches.length === 0) this._pointer.down = false;
    });
  }

  private _updateTouch(t: Touch): void {
    const rect = this._canvas.getBoundingClientRect();
    this._pointer.x = (t.clientX - rect.left) * (this._canvas.width / rect.width);
    this._pointer.y = (t.clientY - rect.top) * (this._canvas.height / rect.height);
  }

  private _normalizeKey(key: string): string {
    return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
  }

  /** 按键是否按下 */
  isDown(...keys: string[]): boolean {
    return keys.some((k) => this._keys.has(k.toLowerCase()));
  }

  /** 移动方向（归一化向量），返回 null 表示无输入 */
  getMoveDir(): { x: number; y: number } | null {
    let x = 0,
      y = 0;
    if (this.isDown('arrowleft', 'a')) x -= 1;
    if (this.isDown('arrowright', 'd')) x += 1;
    if (this.isDown('arrowup', 'w')) y -= 1;
    if (this.isDown('arrowdown', 's')) y += 1;
    if (x === 0 && y === 0) return null;
    const m = Math.hypot(x, y);
    return { x: x / m, y: y / m };
  }

  isSlowMode(): boolean {
    return this.isDown('shift');
  }

  isShooting(): boolean {
    // 键盘按住 z/空格 或 鼠标/触摸按下
    return this.isDown('z', ' ') || this._pointer.down;
  }

  /** 消费炸弹按键（一次性） */
  consumeBomb(): boolean {
    const v = this._bombPressed;
    this._bombPressed = false;
    return v;
  }

  consumePause(): boolean {
    const v = this._pausePressed;
    this._pausePressed = false;
    return v;
  }

  consumeWeaponSwitch(): boolean {
    const v = this._weaponSwitchPressed;
    this._weaponSwitchPressed = false;
    return v;
  }

  getPointer(): { x: number; y: number; down: boolean } {
    return this._pointer;
  }

  /** 触摸/鼠标控制时，飞机应跟随的坐标 */
  getFollowTarget(): { x: number; y: number } | null {
    if (this._scheme === 'touch' || this._scheme === 'mouse') {
      return { x: this._pointer.x, y: this._pointer.y };
    }
    return null;
  }
}
