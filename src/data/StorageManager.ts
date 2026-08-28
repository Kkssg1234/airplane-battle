/**
 * 存储管理：统一封装 LocalStorage + IndexedDB
 * 配置/进度存 LocalStorage，排行榜存 IndexedDB
 * 异常时降级为内存缓存
 */
import type { UserConfig, GameProgress, ScoreRecord } from '../types';
import { DEFAULT_CONFIG, DEFAULT_PROGRESS, STORAGE_KEYS, DB_NAME, DB_VERSION, STORE_SCORES, CONFIG as CFG } from '../data/config';

export class StorageManager {
  private _memConfig: UserConfig | null = null;
  private _memProgress: GameProgress | null = null;
  private _memScores: ScoreRecord[] = [];
  private _lsAvailable = false;
  private _db: IDBDatabase | null = null;
  private _dbAvailable = false;

  async init(): Promise<void> {
    // 检测 LocalStorage
    try {
      const k = '__pw_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      this._lsAvailable = true;
    } catch {
      this._lsAvailable = false;
      console.warn('[Storage] LocalStorage 不可用，降级为内存缓存');
    }
    // 初始化 IndexedDB
    try {
      this._db = await this._openDB();
      this._dbAvailable = true;
    } catch {
      this._dbAvailable = false;
      console.warn('[Storage] IndexedDB 不可用，排行榜将使用内存缓存');
    }
  }

  private _openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SCORES)) {
          const store = db.createObjectStore(STORE_SCORES, { keyPath: 'id', autoIncrement: true });
          store.createIndex('score', 'score', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- 用户配置 ----------
  loadConfig(): UserConfig {
    if (this._memConfig) return this._memConfig;
    let cfg: UserConfig = { ...DEFAULT_CONFIG };
    if (this._lsAvailable) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.config);
        if (raw) {
          cfg = { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<UserConfig>) };
        }
      } catch {
        /* ignore */
      }
    }
    this._memConfig = cfg;
    return cfg;
  }

  saveConfig(cfg: UserConfig): void {
    this._memConfig = cfg;
    if (this._lsAvailable) {
      try {
        localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(cfg));
      } catch (e) {
        console.warn('[Storage] 保存配置失败', e);
      }
    }
  }

  // ---------- 游戏进度 ----------
  loadProgress(): GameProgress {
    if (this._memProgress) return this._memProgress;
    let prog: GameProgress = { ...DEFAULT_PROGRESS, levelBestScores: {}, unlockedPlanes: ['falcon'] };
    if (this._lsAvailable) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.progress);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<GameProgress>;
          prog = { ...prog, ...saved };
          // v1 -> v2 迁移：补全新增字段，highestLevel 映射到 unlockedLevels
          if (saved.version !== DEFAULT_PROGRESS.version) {
            prog.version = DEFAULT_PROGRESS.version;
            if (prog.unlockedLevels == null || prog.unlockedLevels < 1) {
              prog.unlockedLevels = Math.max(1, prog.highestLevel ?? 1);
            }
            prog.highestLevel = prog.unlockedLevels;
            if (!prog.levelBestScores) prog.levelBestScores = {};
            if (!prog.totalScore) prog.totalScore = 0;
            if (!prog.unlockedPlanes?.length) prog.unlockedPlanes = ['falcon'];
            if (!prog.selectedPlane) prog.selectedPlane = 'falcon';
            // 迁移后立即落盘
            this.saveProgress(prog);
          }
        }
      } catch {
        /* ignore */
      }
    }
    this._memProgress = prog;
    return prog;
  }

  saveProgress(p: GameProgress): void {
    p.version = DEFAULT_PROGRESS.version;
    p.lastSavedAt = Date.now();
    this._memProgress = p;
    if (this._lsAvailable) {
      try {
        localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(p));
      } catch (e) {
        console.warn('[Storage] 保存进度失败', e);
      }
    }
  }

  // ---------- 存档便捷接口（关卡/飞机/货币） ----------

  /** 关卡是否已解锁 */
  isLevelUnlocked(levelId: number): boolean {
    return levelId <= this.loadProgress().unlockedLevels;
  }

  /** 通关：解锁下一关 + 记录该关最高分，返回是否首次解锁新关卡 */
  unlockLevel(levelId: number): boolean {
    const p = this.loadProgress();
    let newUnlock = false;
    if (levelId + 1 > p.unlockedLevels) {
      p.unlockedLevels = levelId + 1;
      p.highestLevel = levelId + 1;
      newUnlock = true;
    }
    this.saveProgress(p);
    return newUnlock;
  }

  /** 累计分数货币（独立于单局最高分，用于解锁飞机） */
  addTotalScore(pts: number): void {
    if (pts <= 0) return;
    const p = this.loadProgress();
    p.totalScore += pts;
    this.saveProgress(p);
  }

  /** 记录关卡独立最高分，返回是否刷新纪录 */
  recordLevelScore(levelId: number, score: number, endless: boolean): boolean {
    if (endless) return false; // 无尽模式不按关卡记分
    const p = this.loadProgress();
    const key = String(levelId);
    const best = p.levelBestScores[key] ?? 0;
    if (score > best) {
      p.levelBestScores[key] = score;
      this.saveProgress(p);
      return true;
    }
    return false;
  }

  /** 解锁飞机（花费累计分数货币），返回是否成功 */
  unlockPlane(planeId: import('../types').PlaneTypeId, cost: number): boolean {
    const p = this.loadProgress();
    if (p.unlockedPlanes.includes(planeId)) return false;
    if (p.totalScore < cost) return false;
    p.totalScore -= cost;
    p.unlockedPlanes.push(planeId);
    this.saveProgress(p);
    return true;
  }

  /** 选择飞机（须已解锁） */
  selectPlane(planeId: import('../types').PlaneTypeId): void {
    const p = this.loadProgress();
    if (!p.unlockedPlanes.includes(planeId)) return;
    p.selectedPlane = planeId;
    this.saveProgress(p);
  }

  // ---------- 排行榜 ----------
  async getScores(): Promise<ScoreRecord[]> {
    if (this._dbAvailable && this._db) {
      return new Promise((resolve) => {
        const tx = this._db!.transaction(STORE_SCORES, 'readonly');
        const store = tx.objectStore(STORE_SCORES);
        const req = store.getAll();
        req.onsuccess = () => {
          const arr = (req.result as ScoreRecord[]).sort((a, b) => b.score - a.score).slice(0, CFG.ranks.topN);
          this._memScores = arr;
          resolve(arr);
        };
        req.onerror = () => resolve(this._memScores);
      });
    }
    return [...this._memScores].sort((a, b) => b.score - a.score).slice(0, CFG.ranks.topN);
  }

  async addScore(rec: ScoreRecord): Promise<ScoreRecord[]> {
    if (this._dbAvailable && this._db) {
      await new Promise<void>((resolve) => {
        const tx = this._db!.transaction(STORE_SCORES, 'readwrite');
        tx.objectStore(STORE_SCORES).add(rec);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } else {
      this._memScores.push({ ...rec, id: this._memScores.length + 1 });
    }
    return this.getScores();
  }

  /** 是否进入排行榜 */
  async isHighScore(score: number): Promise<boolean> {
    const scores = await this.getScores();
    if (scores.length < CFG.ranks.topN) return true;
    return score > scores[scores.length - 1].score;
  }
}
