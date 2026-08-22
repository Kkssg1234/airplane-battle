/**
 * 时间管理：deltaTime、帧率统计、慢动作（timeScale）
 */
export class TimeManager {
  private _timeScale = 1;
  private _fps = 60;
  private _frameCount = 0;
  private _fpsAccum = 0;
  private _elapsed = 0; // 游戏内时间（受 timeScale 影响）

  get timeScale(): number {
    return this._timeScale;
  }
  set timeScale(v: number) {
    this._timeScale = v;
  }

  get fps(): number {
    return this._fps;
  }

  get elapsed(): number {
    return this._elapsed;
  }

  /** 每帧调用，传入真实帧耗时(ms) */
  update(realFrameMs: number): number {
    this._frameCount++;
    this._fpsAccum += realFrameMs;
    if (this._fpsAccum >= 500) {
      this._fps = Math.round((this._frameCount * 1000) / this._fpsAccum);
      this._frameCount = 0;
      this._fpsAccum = 0;
    }
    const scaled = (realFrameMs / 1000) * this._timeScale;
    this._elapsed += scaled;
    return scaled;
  }

  /** 慢动作（用于 BOSS 击杀瞬间等） */
  slowmo(scale: number, durationMs: number): void {
    this._timeScale = scale;
    window.setTimeout(() => {
      this._timeScale = 1;
    }, durationMs);
  }

  reset(): void {
    this._timeScale = 1;
    this._elapsed = 0;
    this._frameCount = 0;
    this._fpsAccum = 0;
  }
}
