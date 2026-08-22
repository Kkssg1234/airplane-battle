/**
 * 成就系统：订阅游戏事件，检测解锁条件
 * 解锁时弹出 Toast 并持久化到进度
 */
import { ACHIEVEMENTS } from '../data/config';
import { eventBus } from '../utils/eventBus';
import type { Game } from '../game/Game';

interface Toast {
  text: string;
  desc: string;
  life: number;
  maxLife: number;
}

/** 本局统计（用于成就判定） */
export class RunStats {
  kills = 0;
  bossKills = 0;
  maxCombo = 0;
  combo = 0;
  score = 0;
  noDamage = true;
  bombUsed = false;
  bombSaveCleared = false;
  endlessMinutes = 0;
  clearedLevel = 0;

  reset(): void {
    this.kills = 0;
    this.bossKills = 0;
    this.maxCombo = 0;
    this.combo = 0;
    this.score = 0;
    this.noDamage = true;
    this.bombUsed = false;
    this.bombSaveCleared = false;
    this.endlessMinutes = 0;
    this.clearedLevel = 0;
  }

  onKill(): void {
    this.kills++;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
  }

  onTakeDamage(): void {
    this.noDamage = false;
    this.combo = 0;
  }

  onBossKill(): void {
    this.bossKills++;
  }
}

export class AchievementSystem {
  private _game: Game;
  private _stats: RunStats;
  private _toasts: Toast[] = [];
  private _unlocked: Set<string>;
  private _listeners: Array<() => void> = [];

  constructor(game: Game, stats: RunStats) {
    this._game = game;
    this._stats = stats;
    this._unlocked = new Set(game.storage.loadProgress().unlockedAchievements);
    this._bind();
  }

  private _bind(): void {
    this._listeners.push(
      eventBus.on('enemy:kill', () => {
        this._stats.onKill();
        this._check('ACH_FIRST_BLOOD', () => this._stats.kills >= 1);
        this._check('ACH_COMBO_100', () => this._stats.maxCombo >= 100);
      }),
    );
    this._listeners.push(
      eventBus.on('player:hit', () => {
        this._stats.onTakeDamage();
      }),
    );
    this._listeners.push(
      eventBus.on('boss:kill', () => {
        this._stats.onBossKill();
        this._check('ACH_BOSS_SLAYER', () => this._stats.bossKills >= 1);
      }),
    );
    this._listeners.push(
      eventBus.on('score:change', (p) => {
        const score = (p as { score: number })?.score ?? 0;
        this._stats.score = score;
        this._check('ACH_SCORE_100K', () => score >= 100000);
      }),
    );
    this._listeners.push(
      eventBus.on('bomb:use', () => {
        this._stats.bombUsed = true;
      }),
    );
  }

  /** 通关检测（GameScene 在通关时调用） */
  onLevelComplete(level: number, endless: boolean, endlessMinutes: number): void {
    this._stats.clearedLevel = Math.max(this._stats.clearedLevel, level);
    if (endless) {
      this._stats.endlessMinutes = endlessMinutes;
      this._check('ACH_ENDLESS_5M', () => endlessMinutes >= 5);
    } else {
      this._check('ACH_ALL_LEVELS', () => level >= 6);
      if (this._stats.noDamage) {
        this._check('ACH_NO_DAMAGE', () => true);
      }
      if (this._stats.bombUsed && this._stats.bombSaveCleared) {
        this._check('ACH_BOMB_SAVE', () => true);
      }
    }
    // 更新最高关卡进度
    const progress = this._game.storage.loadProgress();
    if (!endless && level > progress.highestLevel) {
      progress.highestLevel = level;
    }
    progress.totalKills += this._stats.kills;
    progress.unlockedAchievements = Array.from(this._unlocked);
    this._game.storage.saveProgress(progress);
  }

  private _check(id: string, cond: () => boolean): void {
    if (this._unlocked.has(id)) return;
    if (!cond()) return;
    this._unlock(id);
  }

  private _unlock(id: string): void {
    this._unlocked.add(id);
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) return;
    this._toasts.push({ text: `成就解锁: ${ach.name}`, desc: ach.desc, life: 3, maxLife: 3 });
    this._game.audio.playSfx('levelUp');
    eventBus.emit('achievement:unlock', { id, name: ach.name });
    // 持久化
    const progress = this._game.storage.loadProgress();
    if (!progress.unlockedAchievements.includes(id)) {
      progress.unlockedAchievements.push(id);
      this._game.storage.saveProgress(progress);
    }
  }

  update(dt: number): void {
    for (let i = this._toasts.length - 1; i >= 0; i--) {
      this._toasts[i].life -= dt;
      if (this._toasts[i].life <= 0) this._toasts.splice(i, 1);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this._toasts.length; i++) {
      const t = this._toasts[i];
      const w = 300;
      const h = 60;
      const x = (this._game.width - w) / 2;
      const y = 80 + i * (h + 10);
      const fadeIn = Math.min(1, (t.maxLife - t.life) / 0.3);
      const fadeOut = Math.min(1, t.life / 0.5);
      const alpha = Math.min(fadeIn, fadeOut);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(10,24,56,0.92)';
      ctx.strokeStyle = '#FFE600';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#FFE600';
      ctx.shadowBlur = 15;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFE600';
      ctx.font = `bold 16px 'Consolas', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★ ' + t.text, x + w / 2, y + 20);
      ctx.fillStyle = '#E6F7FF';
      ctx.font = `13px 'Consolas', monospace`;
      ctx.fillText(t.desc, x + w / 2, y + 42);
      ctx.restore();
    }
  }

  destroy(): void {
    for (const off of this._listeners) off();
    this._listeners = [];
  }

  get unlocked(): string[] {
    return Array.from(this._unlocked);
  }
}
