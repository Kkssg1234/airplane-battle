/**
 * 碰撞检测系统 v2（性能优化版）
 * 玩家子弹 vs 敌机/BOSS、敌机子弹 vs 玩家、玩家 vs 敌机/道具
 *
 * 优化点：
 * 1. 空间均匀网格（Spatial Hash）：敌机按 64px 网格分桶，玩家子弹只与
 *    所在桶及邻桶的敌机做精确检测，将 O(子弹×敌机) 降为近似 O(子弹+敌机)
 * 2. 直接接收全部子弹按 owner 分发，消除调用方每帧 filter 产生的数组分配
 * 3. 网格桶数组跨帧复用，避免 GC 压力
 */
import { boundsIntersect } from '../utils/math';
import type { Bullet } from '../entities/Bullet';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PowerUp } from '../entities/PowerUp';
import type { Boss } from '../entities/Boss';
import type { Bounds } from '../types';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../data/config';

/** 将任意 Bounds 转为覆盖矩形（网格分桶用） */
function toRect(b: Bounds): { x: number; y: number; w: number; h: number } {
  if ('w' in b) return { x: b.x, y: b.y, w: b.w, h: b.h };
  return { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
}

export interface CollisionCallbacks {
  onPlayerBulletHitEnemy: (bullet: Bullet, enemy: Enemy) => void;
  onPlayerBulletHitBoss: (bullet: Bullet, boss: Boss) => void;
  onEnemyBulletHitPlayer: (bullet: Bullet, player: Player) => void;
  onEnemyHitPlayer: (enemy: Enemy, player: Player) => void;
  onPowerUpPickup: (powerup: PowerUp, player: Player) => void;
  onBossBodyHitPlayer: (boss: Boss, player: Player) => void;
}

/** 网格单元尺寸（约等于敌机直径的 2 倍，兼顾查询范围与分桶粒度） */
const CELL = 64;
const COLS = Math.ceil(DESIGN_WIDTH / CELL) + 2;
const ROWS = Math.ceil(DESIGN_HEIGHT / CELL) + 2;

export class CollisionSystem {
  constructor(private _cb: CollisionCallbacks) {}

  /** 空间网格桶（跨帧复用，key = row * COLS + col） */
  private _grid: Enemy[][] = [];
  private _usedCells: number[] = [];

  check(params: {
    bullets: Bullet[]; // 全部活跃子弹（内部按 owner 分发，避免调用方 filter）
    enemies: Enemy[];
    powerups: PowerUp[];
    player: Player;
    boss: Boss | null;
  }): void {
    const { bullets, enemies, powerups, player, boss } = params;

    // ---- 敌机装入空间网格 ----
    this._buildGrid(enemies);

    // ---- 玩家子弹 vs 敌机（网格查询） + 敌机子弹 vs 玩家 ----
    const pb = player.getBounds();
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b.alive) continue;
      if (b.owner === 'player') {
        // vs 敌机：只查询所在及邻近网格
        if (this._queryGridBullet(b, b.getBounds())) continue; // 命中敌机后不再检测 BOSS
        // vs BOSS
        if (boss && boss.alive && !boss.isEntering && boundsIntersect(b.getBounds(), boss.getBounds())) {
          this._cb.onPlayerBulletHitBoss(b, boss);
        }
      } else if (player.alive && boundsIntersect(b.getBounds(), pb)) {
        this._cb.onEnemyBulletHitPlayer(b, player);
      }
    }

    // ---- 敌机/BOSS vs 玩家（体碰撞） ----
    if (player.alive) {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (boundsIntersect(e.getBounds(), player.getBounds())) {
          this._cb.onEnemyHitPlayer(e, player);
        }
      }
      if (boss && boss.alive && !boss.isEntering && boundsIntersect(boss.getBounds(), player.getBounds())) {
        this._cb.onBossBodyHitPlayer(boss, player);
      }
    }

    // ---- 道具 vs 玩家 ----
    if (player.alive) {
      for (const p of powerups) {
        if (!p.alive) continue;
        if (boundsIntersect(p.getBounds(), player.getBounds())) {
          this._cb.onPowerUpPickup(p, player);
        }
      }
    }
  }

  /** 构建敌机空间网格（复用桶数组，清空仅重置已使用的桶） */
  private _buildGrid(enemies: Enemy[]): void {
    // 清空上一帧使用的桶（长度极小，开销可忽略）
    for (const key of this._usedCells) this._grid[key].length = 0;
    this._usedCells.length = 0;

    for (const e of enemies) {
      if (!e.alive) continue;
      // 敌机半径可能跨多个格子：以包围盒覆盖的格子都插入
      const b = e.getBounds();
      const rect = 'w' in b ? b : { x: (b as { x: number; y: number; r: number }).x - (b as { r: number }).r, y: (b as { x: number; y: number; r: number }).y - (b as { r: number }).r, w: (b as { r: number }).r * 2, h: (b as { r: number }).r * 2 };
      const c0 = Math.floor(rect.x / CELL);
      const c1 = Math.floor((rect.x + rect.w) / CELL);
      const r0 = Math.floor(rect.y / CELL);
      const r1 = Math.floor((rect.y + rect.h) / CELL);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
          const key = r * COLS + c;
          let bucket = this._grid[key];
          if (!bucket) {
            bucket = this._grid[key] = [];
          }
          if (bucket.length === 0) this._usedCells.push(key);
          bucket.push(e);
        }
      }
    }
  }

  /** 子弹网格查询：与所在及邻近桶中的敌机精确检测，命中返回 true */
  private _queryGridBullet(b: Bullet, bounds: Bounds): boolean {
    const rect = toRect(bounds);
    const c0 = Math.floor((rect.x - 8) / CELL);
    const c1 = Math.floor((rect.x + rect.w + 8) / CELL);
    const r0 = Math.floor((rect.y - 8) / CELL);
    const r1 = Math.floor((rect.y + rect.h + 8) / CELL);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const bucket = this._grid[r * COLS + c];
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const e = bucket[k];
          if (e.alive && boundsIntersect(b.getBounds(), e.getBounds())) {
            this._cb.onPlayerBulletHitEnemy(b, e);
            return true;
          }
        }
      }
    }
    return false;
  }
}
