/**
 * 游戏主循环：固定逻辑步长 + 可变渲染
 * 使用 requestAnimationFrame，防止后台切换大跳
 */
import { TimeManager } from './TimeManager';
import { CONFIG } from '../data/config';

export class GameLoop {
  private _rafId = 0;
  private _lastTime = 0;
  private _accumulator = 0;
  private _running = false;
  private _time: TimeManager;

  constructor(
    time: TimeManager,
    private _update: (dt: number) => void,
    private _render: () => void,
  ) {
    this._time = time;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._rafId = requestAnimationFrame(this._tick);
  }

  stop(): void {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  get running(): boolean {
    return this._running;
  }

  private _tick = (now: number): void => {
    if (!this._running) return;
    const frameMs = Math.min(now - this._lastTime, CONFIG.maxFrameSkip);
    this._lastTime = now;

    // 固定步长更新逻辑
    this._accumulator += frameMs * this._time.timeScale;
    const step = CONFIG.fixedDt;
    let steps = 0;
    while (this._accumulator >= step && steps < 10) {
      this._time.update(step);
      this._update(step / 1000);
      this._accumulator -= step;
      steps++;
    }
    // 防止堆积
    if (this._accumulator > step * 10) this._accumulator = 0;

    // 渲染
    this._render();
    this._rafId = requestAnimationFrame(this._tick);
  };
}
