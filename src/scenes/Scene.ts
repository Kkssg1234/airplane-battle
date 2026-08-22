/**
 * 场景基类
 * 所有场景继承此类，实现 update/render
 */
import type { Game } from '../game/Game';

export abstract class Scene {
  protected game: Game;
  /** 场景是否已激活 */
  protected _active = false;

  constructor(game: Game) {
    this.game = game;
  }

  /** 进入场景时调用 */
  onEnter(): void {
    this._active = true;
  }

  /** 离开场景时调用 */
  onExit(): void {
    this._active = false;
  }

  /** 暂停（被新场景覆盖时） */
  onPause(): void {}

  /** 恢复（覆盖场景弹出时） */
  onResume(): void {}

  /** 逻辑更新（固定步长） */
  abstract update(dt: number): void;

  /** 渲染 */
  abstract render(ctx: CanvasRenderingContext2D): void;

  /** 输入事件透传（可选） */
  onPointerDown?(x: number, y: number): void;
  onPointerMove?(x: number, y: number): void;
  onPointerUp?(x: number, y: number): void;
  onKeyDown?(key: string): void;
  onKeyUp?(key: string): void;
}
