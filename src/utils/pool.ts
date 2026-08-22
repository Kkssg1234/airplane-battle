/**
 * 对象池：复用对象避免频繁 GC
 * 用于子弹、粒子等高频创建销毁的实体
 */
export class ObjectPool<T> {
  private _free: T[] = [];
  private _active = new Set<T>();

  constructor(
    private _factory: () => T,
    private _reset: (o: T) => void,
    preallocate = 0,
  ) {
    for (let i = 0; i < preallocate; i++) {
      this._free.push(this._factory());
    }
  }

  acquire(): T {
    const obj = this._free.pop() ?? this._factory();
    this._active.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (this._active.delete(obj)) {
      this._reset(obj);
      this._free.push(obj);
    }
  }

  releaseAll(): void {
    for (const o of this._active) {
      this._reset(o);
      this._free.push(o);
    }
    this._active.clear();
  }

  get activeCount(): number {
    return this._active.size;
  }

  /** 遍历所有活跃对象（释放操作需谨慎） */
  forEachActive(fn: (o: T) => void): void {
    for (const o of this._active) fn(o);
  }

  /** 获取活跃对象快照数组（用于安全遍历删除） */
  snapshot(): T[] {
    return Array.from(this._active);
  }
}
