/**
 * 事件总线：系统间解耦通信
 * 用法: emit('player:hit', {damage:1}); on('player:hit', handler)
 */
import type { GameEvent } from '../types';

type Handler = (payload?: unknown) => void;

class EventBus {
  private _handlers = new Map<string, Set<Handler>>();

  on(event: GameEvent | string, handler: Handler): () => void {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off(event: GameEvent | string, handler: Handler): void {
    this._handlers.get(event)?.delete(handler);
  }

  emit(event: GameEvent | string, payload?: unknown): void {
    const set = this._handlers.get(event);
    if (!set) return;
    // 复制一份避免回调中增删导致迭代异常
    for (const h of Array.from(set)) {
      try {
        h(payload);
      } catch (e) {
        console.error(`[EventBus] handler error for "${event}":`, e);
      }
    }
  }

  clear(): void {
    this._handlers.clear();
  }
}

export const eventBus = new EventBus();
