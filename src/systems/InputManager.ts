/**
 * 输入管理：统一键盘/鼠标/触摸输入
 * 暴露语义化接口供场景使用
 */
import type { ControlScheme } from '../types';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../data/config';

export interface UiRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

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

  /** UI 按钮命中区域（逻辑坐标），命中时不激活飞机跟随，避免误触移动 */
  private _uiHitAreas: UiRect[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._bindEvents();
  }

  /** 移动端检测：保守策略，仅依据 UA/平台，绝不误判触屏笔记本为移动端（保护桌面端） */
  static isMobile(): boolean {
    const ua = navigator.userAgent || '';
    // 明确的手机/平板 UA
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|Tablet|Mobile/i.test(ua);
    // iPadOS 13+ 伪装为 Mac 桌面 UA：通过 MacIntel 平台 + 触屏识别
    const isIpad =
      (navigator.platform || '').includes('Mac') && (navigator.maxTouchPoints || 0) > 0;
    return isMobileUA || isIpad;
  }

  setScheme(scheme: ControlScheme): void {
    this._scheme = scheme;
  }

  get scheme(): ControlScheme {
    return this._scheme;
  }

  /** 设置 UI 按钮命中区域（逻辑坐标），触摸命中这些区域时不触发飞机跟随 */
  setUiHitAreas(areas: UiRect[]): void {
    this._uiHitAreas = areas;
  }

  private _isOnUi(x: number, y: number): boolean {
    for (const a of this._uiHitAreas) {
      if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return true;
    }
    return false;
  }

  /** 屏幕坐标转逻辑坐标（设计分辨率），与 Game._toLogical 保持一致 */
  private _toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this._canvas.getBoundingClientRect();
    // 防御性：rect.width/height 为 0 时退回设计尺寸
    const w = rect.width > 0 ? rect.width : DESIGN_WIDTH;
    const h = rect.height > 0 ? rect.height : DESIGN_HEIGHT;
    return {
      x: ((clientX - rect.left) / w) * DESIGN_WIDTH,
      y: ((clientY - rect.top) / h) * DESIGN_HEIGHT,
    };
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
      const p = this._toLocal(e.clientX, e.clientY);
      this._pointer.x = p.x;
      this._pointer.y = p.y;
      this._pointer.down = (e.buttons & 1) === 1;
    });
    this._canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const p = this._toLocal(e.clientX, e.clientY);
      this._pointer.x = p.x;
      this._pointer.y = p.y;
      this._pointer.down = true;
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
        if (t) {
          const p = this._toLocal(t.clientX, t.clientY);
          this._pointer.x = p.x;
          this._pointer.y = p.y;
          // 命中 UI 按钮区域时不激活飞机跟随，交由场景处理按钮
          this._pointer.down = !this._isOnUi(p.x, p.y);
        }
      },
      { passive: false },
    );
    this._canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        const t = e.touches[0];
        if (t) {
          const p = this._toLocal(t.clientX, t.clientY);
          this._pointer.x = p.x;
          this._pointer.y = p.y;
        }
      },
      { passive: false },
    );
    this._canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._touchCount = e.touches.length;
      if (e.touches.length === 0) this._pointer.down = false;
    });
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
    // 移动端自动连射；桌面端手动（键 z/空格 或 鼠标按下）
    if (this._scheme === 'touch') return true;
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

  /** 鼠标控制时，飞机应跟随的坐标（绝对位置，桌面端） */
  getFollowTarget(): { x: number; y: number } | null {
    if (this._scheme === 'mouse') {
      return { x: this._pointer.x, y: this._pointer.y };
    }
    return null;
  }
}
