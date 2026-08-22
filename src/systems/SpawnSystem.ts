/**
 * 敌机生成系统：根据关卡数据程序化生成波次
 * 支持普通生成、编队生成、精英生成
 */
import { Enemy } from '../entities/Enemy';
import { getLevel, canSpawn } from '../data/levels';
import type { EnemyTypeId, Vec2 } from '../types';
import { chance, pick, range } from '../utils/random';

export class SpawnSystem {
  private _timer = 0;
  private _levelId: number;
  private _endless: boolean;
  private _spawnInterval: number;
  private _difficulty: number;
  private _endlessTime = 0;

  constructor(levelId: number, endless: boolean) {
    this._levelId = levelId;
    this._endless = endless;
    const level = getLevel(levelId);
    this._spawnInterval = level.spawnInterval;
    this._difficulty = level.difficulty;
  }

  get difficulty(): number {
    return this._difficulty;
  }

  /** 无尽模式难度递增 */
  get endlessElapsed(): number {
    return this._endlessTime;
  }

  /**
   * 每帧更新，返回本帧应生成的敌机列表
   */
  update(dt: number, spawnCallback: (type: EnemyTypeId, x: number, y: number, difficulty: number) => Enemy): boolean {
    this._timer -= dt;
    if (this._endless) this._endlessTime += dt;

    // 无尽模式难度随时间增长
    if (this._endless) {
      this._difficulty = 3 + this._endlessTime / 30; // 每30秒难度+1
      this._spawnInterval = Math.max(0.35, 1.0 - this._endlessTime / 120);
    }

    if (this._timer > 0) return false;
    this._timer = this._spawnInterval * range(0.7, 1.3);
    this._spawnWave(spawnCallback);
    return true;
  }

  private _spawnWave(cb: (type: EnemyTypeId, x: number, y: number, difficulty: number) => Enemy): void {
    const level = getLevel(this._levelId);
    // 无尽模式使用所有敌机类型
    const pool = this._endless
      ? (['E1', 'E2', 'E3', 'E4', 'E5', 'E6'] as EnemyTypeId[])
      : level.enemyPool.filter((t) => canSpawn(t, this._levelId));

    const roll = Math.random();
    if (roll < 0.55) {
      // 单个
      const type = pick(pool);
      const x = range(60, 480);
      cb(type, x, -30, this._difficulty);
    } else if (roll < 0.85) {
      // 横排编队 3-5 个
      const type = pick(pool.filter((t) => t !== 'E4') || pool);
      const count = Math.floor(range(3, 6));
      const startX = range(80, 540 - 80 - (count - 1) * 50);
      for (let i = 0; i < count; i++) {
        cb(type, startX + i * 50, -30 - i * 10, this._difficulty);
      }
    } else {
      // 精英敌机
      const elite = pool.filter((t) => ['E3', 'E5', 'E6'].includes(t));
      if (elite.length) {
        const type = pick(elite);
        cb(type, range(80, 460), -30, this._difficulty);
      }
    }
  }
}
