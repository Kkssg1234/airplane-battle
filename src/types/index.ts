/**
 * 全局类型定义
 * 所有跨模块共享的类型集中于此
 */

/** 向量 */
export interface Vec2 {
  x: number;
  y: number;
}

/** 矩形包围盒（轴对齐） */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 圆形包围盒 */
export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** 碰撞形状 */
export type Bounds = Rect | Circle;

/** 实体阵营（决定碰撞分组） */
export type Faction = 'player' | 'enemy' | 'playerBullet' | 'enemyBullet' | 'powerup' | 'neutral';

/** 场景标识 */
export type SceneId = 'boot' | 'menu' | 'game' | 'pause' | 'gameover' | 'levelSelect' | 'planeSelect';

/** 飞机型号 ID（默认机 + 3 款可解锁新机） */
export type PlaneTypeId = 'falcon' | 'swift' | 'fortress' | 'phantom';

/** 画质等级 */
export type Quality = 'low' | 'medium' | 'high';

/** 控制方案 */
export type ControlScheme = 'keyboard' | 'mouse' | 'touch';

/** 用户配置（LocalStorage 持久化） */
export interface UserConfig {
  version: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  quality: Quality;
  controlScheme: ControlScheme;
}

/** 游戏进度（LocalStorage 持久化，v2 结构） */
export interface GameProgress {
  version: string;
  /** 兼容字段：已解锁的最大关卡（1-based，与 unlockedLevels 同步） */
  highestLevel: number;
  /** 已解锁关卡数：玩家可自由选择 1..unlockedLevels 的任意关卡 */
  unlockedLevels: number;
  /** 每关独立最高分：{ [levelId]: bestScore } */
  levelBestScores: Record<string, number>;
  /** 累计总分（货币）：用于解锁新飞机，独立于单局最高分 */
  totalScore: number;
  /** 已解锁飞机列表 */
  unlockedPlanes: PlaneTypeId[];
  /** 当前选中飞机 */
  selectedPlane: PlaneTypeId;
  totalKills: number;
  totalPlayTime: number;
  unlockedAchievements: string[];
  lastSavedAt: number;
}

/** 飞机主动技能定义 */
export interface PlaneSkill {
  id: 'overdrive' | 'fortress' | 'phase';
  name: string;
  desc: string;
  cooldown: number; // 冷却秒数
  duration: number; // 持续秒数（瞬发类为无敌时长）
}

/** 排行榜记录（IndexedDB 持久化） */
export interface ScoreRecord {
  id?: number;
  score: number;
  level: number;
  kills: number;
  player: string;
  createdAt: number;
}

/** 道具类型 */
export type PowerUpType = 'weapon' | 'shield' | 'score' | 'bomb' | 'heal' | 'wipe';

/** 敌机类型 ID */
export type EnemyTypeId = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6';

/** 子弹归属 */
export type BulletOwner = 'player' | 'enemy';

/** 游戏事件总线事件名 */
export type GameEvent =
  | 'player:hit'
  | 'player:death'
  | 'player:shoot'
  | 'enemy:kill'
  | 'boss:kill'
  | 'powerup:pickup'
  | 'level:complete'
  | 'level:start'
  | 'achievement:unlock'
  | 'bomb:use'
  | 'skill:use'
  | 'score:change';

/** 成就定义 */
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  condition: string;
}

/** 关卡波次中的敌机生成条目 */
export interface SpawnEntry {
  type: EnemyTypeId;
  time: number; // 关卡开始后秒数
  x: number; // 相对画布宽度的比例 0-1
  pattern?: 'line' | 'sine' | 'side' | 'track';
  count?: number;
  interval?: number; // 编队间隔秒
}
