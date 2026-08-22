/**
 * 关卡数据定义
 * 每关：名称、时长、敌机池、BOSS 主题、难度系数
 * SpawnSystem 根据这些数据程序化生成波次
 */
import { ENEMY_DEFS } from './config';
import type { EnemyTypeId } from '../types';
import { BOSS_THEMES } from '../entities/Boss';

export interface LevelDef {
  id: number;
  name: string;
  duration: number; // BOSS 出现前持续秒数
  bossThemeId: number;
  difficulty: number; // 基础难度系数
  enemyPool: EnemyTypeId[]; // 本关可生成的敌机类型
  spawnInterval: number; // 平均生成间隔(秒)
  bgHue: number; // 背景色相
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: '第一关 · 突袭前哨',
    duration: 45,
    bossThemeId: 1,
    difficulty: 1,
    enemyPool: ['E1', 'E2'],
    spawnInterval: 1.4,
    bgHue: 200,
  },
  {
    id: 2,
    name: '第二关 · 弹幕初体验',
    duration: 55,
    bossThemeId: 2,
    difficulty: 1.3,
    enemyPool: ['E1', 'E2', 'E3'],
    spawnInterval: 1.2,
    bgHue: 260,
  },
  {
    id: 3,
    name: '第三关 · 追踪锁定',
    duration: 60,
    bossThemeId: 3,
    difficulty: 1.6,
    enemyPool: ['E2', 'E3', 'E4'],
    spawnInterval: 1.1,
    bgHue: 140,
  },
  {
    id: 4,
    name: '第四关 · 编队压制',
    duration: 65,
    bossThemeId: 4,
    difficulty: 2.0,
    enemyPool: ['E2', 'E3', 'E4', 'E5'],
    spawnInterval: 1.0,
    bgHue: 300,
  },
  {
    id: 5,
    name: '第五关 · 幻影突袭',
    duration: 70,
    bossThemeId: 5,
    difficulty: 2.5,
    enemyPool: ['E3', 'E4', 'E5', 'E6'],
    spawnInterval: 0.9,
    bgHue: 330,
  },
  {
    id: 6,
    name: '第六关 · 终焉之战',
    duration: 80,
    bossThemeId: 6,
    difficulty: 3.0,
    enemyPool: ['E2', 'E3', 'E4', 'E5', 'E6'],
    spawnInterval: 0.8,
    bgHue: 0,
  },
];

export const MAX_LEVEL = LEVELS.length;

export function getLevel(id: number): LevelDef {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, id - 1))];
}

export function getBossTheme(levelId: number) {
  const level = getLevel(levelId);
  return BOSS_THEMES.find((t) => t.id === level.bossThemeId) ?? BOSS_THEMES[0];
}

/** 检查敌机是否可在该关出现（minLevel 限制） */
export function canSpawn(type: EnemyTypeId, levelId: number): boolean {
  return levelId >= ENEMY_DEFS[type].minLevel;
}
