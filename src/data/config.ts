/**
 * 全局配置常量
 * 所有数值集中管理，禁止魔法数字散落代码
 */
import type { UserConfig, Achievement } from '../types';

/** 设计分辨率（竖屏基准） */
export const DESIGN_WIDTH = 540;
export const DESIGN_HEIGHT = 960;

/** 调色板（科技风） */
export const PALETTE = {
  bg: '#05070F',
  bgGrid: '#0a1838',
  primary: '#00F0FF', // 青
  accent: '#FF2E88', // 品红
  warning: '#FFE600', // 黄
  text: '#E6F7FF',
  danger: '#FF3030',
  green: '#00FF88',
  purple: '#B026FF',
} as const;

/** 字体 */
export const FONTS = {
  title: "'Orbitron', 'Consolas', sans-serif",
  body: "'Rajdhani', 'Microsoft YaHei', sans-serif",
  mono: "'Share Tech Mono', 'Consolas', monospace",
} as const;

/** 核心数值配置 */
export const CONFIG = {
  fps: 60,
  fixedDt: 1000 / 60,
  maxFrameSkip: 250,

  player: {
    speed: 360,
    slowSpeed: 144,
    accel: 0.15, // 加速到最大速度的时间(秒)
    maxHp: 3,
    initBombs: 2,
    maxBombs: 5,
    maxWeaponLevel: 5,
    invincibleTime: 1.5, // 受击后无敌秒数
    bombInvincibleTime: 1.0,
    hitboxRadius: 4, // 判定点半径（低速时显示）
    shootInterval: 1 / 6, // 每发间隔秒 (Lv1)
  },

  bullet: {
    poolSize: 400,
    playerSpeed: 720,
    enemySpeed: 280,
    playerRadius: 4,
    enemyRadius: 6,
  },

  particle: {
    maxCount: 600,
  },

  ranks: {
    topN: 50,
  },

  powerUp: {
    magnetRadius: 90,
    dropChance: 0.05,
    eliteDropChance: 0.3,
    fallSpeed: 120,
  },

  bomb: {
    clearRadius: 9999, // 全屏
  },
} as const;

/** 默认用户配置 */
export const DEFAULT_CONFIG: UserConfig = {
  version: '1.0.0',
  soundEnabled: true,
  musicEnabled: true,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  quality: 'high',
  controlScheme: 'keyboard',
};

/** 默认游戏进度 */
export const DEFAULT_PROGRESS = {
  version: '1.0.0',
  highestLevel: 1,
  totalKills: 0,
  totalPlayTime: 0,
  unlockedAchievements: [],
  lastSavedAt: 0,
};

/** 敌机定义表 */
export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  score: number;
  radius: number;
  color: string;
  fireRate: number; // 每秒射击次数，0=不射击
  bulletSpeed: number;
  minLevel: number;
  pattern: 'line' | 'sine' | 'side' | 'track';
  elite?: boolean;
  shielded?: boolean;
  cloaked?: boolean;
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  E1: { id: 'E1', name: '侦察机', hp: 1, speed: 160, score: 100, radius: 16, color: '#00F0FF', fireRate: 0, bulletSpeed: 0, minLevel: 1, pattern: 'line' },
  E2: { id: 'E2', name: '截击机', hp: 3, speed: 130, score: 200, radius: 18, color: '#00FF88', fireRate: 0.6, bulletSpeed: 260, minLevel: 1, pattern: 'sine' },
  E3: { id: 'E3', name: '重装机', hp: 8, speed: 90, score: 500, radius: 24, color: '#FFE600', fireRate: 0.8, bulletSpeed: 240, minLevel: 2, pattern: 'side', elite: true },
  E4: { id: 'E4', name: '自爆机', hp: 2, speed: 200, score: 300, radius: 16, color: '#FF3030', fireRate: 0, bulletSpeed: 0, minLevel: 3, pattern: 'track' },
  E5: { id: 'E5', name: '护盾机', hp: 6, speed: 100, score: 600, radius: 22, color: '#B026FF', fireRate: 0.5, bulletSpeed: 220, minLevel: 4, pattern: 'line', elite: true, shielded: true },
  E6: { id: 'E6', name: '隐形机', hp: 4, speed: 150, score: 800, radius: 18, color: '#FF2E88', fireRate: 0.7, bulletSpeed: 300, minLevel: 5, pattern: 'sine', cloaked: true },
};

/** 武器等级定义 */
export interface WeaponLevel {
  bullets: number; // 同时发射子弹数
  spread: number; // 扇形角度(度)
  damage: number;
  fireRate: number; // 每秒发射次数
  homing: number; // 追踪弹数量
  homingDamage: number;
}

export const WEAPON_LEVELS: WeaponLevel[] = [
  { bullets: 1, spread: 0, damage: 1, fireRate: 6, homing: 0, homingDamage: 0 },
  { bullets: 2, spread: 0, damage: 1, fireRate: 6, homing: 0, homingDamage: 0 },
  { bullets: 3, spread: 18, damage: 1, fireRate: 7, homing: 0, homingDamage: 0 },
  { bullets: 3, spread: 18, damage: 1, fireRate: 7, homing: 2, homingDamage: 0.5 },
  { bullets: 5, spread: 28, damage: 1, fireRate: 8, homing: 2, homingDamage: 0.5 },
];

/** 道具掉落权重 */
export const POWERUP_WEIGHTS: { type: import('../types').PowerUpType; weight: number }[] = [
  { type: 'weapon', weight: 30 },
  { type: 'shield', weight: 15 },
  { type: 'score', weight: 20 },
  { type: 'bomb', weight: 10 },
  { type: 'heal', weight: 15 },
  { type: 'wipe', weight: 10 },
];

/** 道具颜色映射 */
export const POWERUP_COLORS: Record<string, { color: string; letter: string; name: string }> = {
  weapon: { color: '#FF2E88', letter: 'P', name: '武器升级' },
  shield: { color: '#00F0FF', letter: 'S', name: '护盾' },
  score: { color: '#FFE600', letter: 'M', name: '得分加倍' },
  bomb: { color: '#B026FF', letter: 'B', name: '炸弹' },
  heal: { color: '#00FF88', letter: 'H', name: '回血' },
  wipe: { color: '#FFFFFF', letter: 'W', name: '清屏' },
};

/** 成就定义表 */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'ACH_FIRST_BLOOD', name: '初战告捷', desc: '击杀第 1 架敌机', condition: 'kill>=1' },
  { id: 'ACH_COMBO_100', name: '连击大师', desc: '单局连击 100+', condition: 'combo>=100' },
  { id: 'ACH_NO_DAMAGE', name: '完美主义', desc: '无伤通关任意关卡', condition: 'noDamageClear' },
  { id: 'ACH_BOSS_SLAYER', name: '屠龙者', desc: '击败首个 BOSS', condition: 'bossKill>=1' },
  { id: 'ACH_ALL_LEVELS', name: '通关大师', desc: '通关全部 6 关', condition: 'clearLevel>=6' },
  { id: 'ACH_SCORE_100K', name: '十万王牌', desc: '单局得分 10 万', condition: 'score>=100000' },
  { id: 'ACH_BOMB_SAVE', name: '绝地反击', desc: '残血用炸弹后通关', condition: 'bombSaveClear' },
  { id: 'ACH_ENDLESS_5M', name: '无尽漫游', desc: '无尽模式生存 5 分钟', condition: 'endless5min' },
];

/** 存储命名空间 */
export const STORAGE_KEYS = {
  config: 'pw_config',
  progress: 'pw_progress',
} as const;

export const DB_NAME = 'PlaneWarDB';
export const DB_VERSION = 1;
export const STORE_SCORES = 'scores';
