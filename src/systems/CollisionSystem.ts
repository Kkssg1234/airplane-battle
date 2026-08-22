/**
 * 碰撞检测系统：分组检测
 * 玩家子弹 vs 敌机/BOSS
 * 敌机子弹 vs 玩家
 * 玩家 vs 敌机/道具
 * 使用 bounds 检测，无需空间分区（实体量适中）
 */
import { boundsIntersect } from '../utils/math';
import type { Bullet } from '../entities/Bullet';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { PowerUp } from '../entities/PowerUp';
import type { Boss } from '../entities/Boss';

export interface CollisionCallbacks {
  onPlayerBulletHitEnemy: (bullet: Bullet, enemy: Enemy) => void;
  onPlayerBulletHitBoss: (bullet: Bullet, boss: Boss) => void;
  onEnemyBulletHitPlayer: (bullet: Bullet, player: Player) => void;
  onEnemyHitPlayer: (enemy: Enemy, player: Player) => void;
  onPowerUpPickup: (powerup: PowerUp, player: Player) => void;
  onBossBodyHitPlayer: (boss: Boss, player: Player) => void;
}

export class CollisionSystem {
  constructor(private _cb: CollisionCallbacks) {}

  check(params: {
    playerBullets: Bullet[];
    enemyBullets: Bullet[];
    enemies: Enemy[];
    powerups: PowerUp[];
    player: Player;
    boss: Boss | null;
  }): void {
    const { playerBullets, enemyBullets, enemies, powerups, player, boss } = params;

    // 玩家子弹 vs 敌机
    for (const b of playerBullets) {
      if (!b.alive) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (boundsIntersect(b.getBounds(), e.getBounds())) {
          this._cb.onPlayerBulletHitEnemy(b, e);
          break;
        }
      }
    }

    // 玩家子弹 vs BOSS
    if (boss && boss.alive && !boss.isEntering) {
      for (const b of playerBullets) {
        if (!b.alive) continue;
        if (boundsIntersect(b.getBounds(), boss.getBounds())) {
          this._cb.onPlayerBulletHitBoss(b, boss);
        }
      }
    }

    // 敌机子弹 vs 玩家
    if (player.alive) {
      for (const b of enemyBullets) {
        if (!b.alive) continue;
        if (boundsIntersect(b.getBounds(), player.getBounds())) {
          this._cb.onEnemyBulletHitPlayer(b, player);
        }
      }
    }

    // 敌机 vs 玩家（碰撞）
    if (player.alive) {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (boundsIntersect(e.getBounds(), player.getBounds())) {
          this._cb.onEnemyHitPlayer(e, player);
        }
      }
      // BOSS 撞玩家
      if (boss && boss.alive && !boss.isEntering && boundsIntersect(boss.getBounds(), player.getBounds())) {
        this._cb.onBossBodyHitPlayer(boss, player);
      }
    }

    // 道具 vs 玩家
    if (player.alive) {
      for (const p of powerups) {
        if (!p.alive) continue;
        if (boundsIntersect(p.getBounds(), player.getBounds())) {
          this._cb.onPowerUpPickup(p, player);
        }
      }
    }
  }
}
