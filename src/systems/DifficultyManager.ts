/**
 * 难度管理：根据关卡、时间、分数动态调整难度系数
 */
export class DifficultyManager {
  private _levelId: number;
  private _endless: boolean;
  private _elapsed = 0;
  private _score = 0;

  constructor(levelId: number, endless: boolean) {
    this._levelId = levelId;
    this._endless = endless;
  }

  update(dt: number): void {
    this._elapsed += dt;
  }

  setScore(score: number): void {
    this._score = score;
  }

  /** 全局难度系数 D(t) */
  get difficulty(): number {
    const levelTerm = 1 + 0.15 * (this._levelId - 1);
    const timeTerm = 0.02 * (this._elapsed / 60);
    const scoreTerm = 0.0001 * this._score;
    return levelTerm + timeTerm + scoreTerm;
  }

  get elapsed(): number {
    return this._elapsed;
  }
}
