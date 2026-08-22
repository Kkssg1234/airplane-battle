/**
 * 场景管理：场景栈，支持 push（覆盖）/ pop / switch（替换）
 */
import type { SceneId } from '../types';
import { Scene } from './Scene';

export class SceneManager {
  private _stack: Scene[] = [];

  get current(): Scene | undefined {
    return this._stack[this._stack.length - 1];
  }

  get size(): number {
    return this._stack.length;
  }

  /** 替换栈底场景（清空栈并压入） */
  switch(scene: Scene): void {
    for (const s of this._stack) {
      s.onExit();
    }
    this._stack = [scene];
    scene.onEnter();
  }

  /** 压入新场景（覆盖当前，当前场景 onPause） */
  push(scene: Scene): void {
    if (this._stack.length) {
      this._stack[this._stack.length - 1].onPause();
    }
    this._stack.push(scene);
    scene.onEnter();
  }

  /** 弹出栈顶场景 */
  pop(): Scene | undefined {
    const top = this._stack.pop();
    if (top) {
      top.onExit();
      this.current?.onResume();
    }
    return top;
  }

  /** 清空所有场景 */
  clear(): void {
    for (const s of this._stack) s.onExit();
    this._stack = [];
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 渲染栈中所有场景（pause 场景覆盖在 game 之上）
    for (const s of this._stack) {
      s.render(ctx);
    }
  }

  /** 输入事件只透传给栈顶场景 */
  dispatchPointerDown(x: number, y: number): void {
    this.current?.onPointerDown?.(x, y);
  }
  dispatchPointerMove(x: number, y: number): void {
    this.current?.onPointerMove?.(x, y);
  }
  dispatchPointerUp(x: number, y: number): void {
    this.current?.onPointerUp?.(x, y);
  }
  dispatchKeyDown(key: string): void {
    this.current?.onKeyDown?.(key);
  }
  dispatchKeyUp(key: string): void {
    this.current?.onKeyUp?.(key);
  }
}
