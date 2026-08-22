/**
 * GameScene 战斗主场景
 * 编排玩家、敌机、子弹、道具、BOSS、粒子、碰撞、生成、难度、成就
 * 管理关卡流程：开场 -> 战斗 -> BOSS战 -> 通关/失败
 */
import { Scene } from './Scene';
import type { Game } from '../game/Game';
import { Player } from '../entities/Player';
import { BulletSystem } from '../entities/Bullet';
import { Enemy } from '../entities/Enemy';
import { PowerUp, randomPowerUpType } from '../entities/PowerUp';
import { Boss } from '../entities/Boss';
import { ParticleSystem } from '../entities/Particle';
import { CollisionSystem } from '../systems/CollisionSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import { DifficultyManager } from '../systems/DifficultyManager';
import { AchievementSystem, RunStats } from '../systems/AchievementSystem';
import { HUD } from '../ui/HUD';
import { CONFIG, PALETTE, FONTS } from '../data/config';
import { getLevel, MAX_LEVEL, getBossTheme } from '../data/levels';
import type { EnemyTypeId, PowerUpType } from '../types';
import { eventBus } from '../utils/eventBus';
import { chance, range } from '../utils/random';
import { easeOutCubic } from '../utils/math';

type Phase = 'intro' | 'playing' | 'bossWarn' | 'boss' | 'cleared' | 'dead';

export class GameScene extends Scene {
  private _levelId: number;
  private _endless: boolean;
  private _phase: Phase = 'intro';

  private _player: Player;
  private _bullets: BulletSystem;
  private _enemies: Enemy[] = [];
  private _powerups: PowerUp[] = [];
  private _boss: Boss | null = null;
  private _particles: ParticleSystem;
  private _collision: CollisionSystem;
  private _spawner: SpawnSystem;
  private _difficulty: DifficultyManager;
  private _achievements: AchievementSystem;
  private _stats: RunStats;
  private _hud: HUD;

  private _score = 0;
  private _levelTime = 0; // 关卡已用时
  private _phaseTimer = 0;
  private _introT = 0;
  private _bossWarnT = 0;
  private _clearedT = 0;
  private _deadT = 0;
  private _vignette = 0; // 受击红屏
  private _bossSummonListener: () => void;
  private _shootListener: () => void;

  constructor(game: Game, levelId: number, endless: boolean) {
    super(game);
    this._levelId = levelId;
    this._endless = endless;
    const w = game.width;
    const h = game.height;

    this._bullets = new BulletSystem();
    this._particles = new ParticleSystem();
    this._player = new Player(game.input, this._bullets, this._particles, w, h);
    this._stats = new RunStats();
    this._difficulty = new DifficultyManager(levelId, endless);
    this._spawner = new SpawnSystem(levelId, endless);
    this._hud = new HUD();
    this._hud.setLevel(levelId, endless);

    this._collision = new CollisionSystem({
      onPlayerBulletHitEnemy: (b, e) => this._onBulletHitEnemy(b, e),
      onPlayerBulletHitBoss: (b, boss) => this._onBulletHitBoss(b, boss),
      onEnemyBulletHitPlayer: (b, p) => this._onEnemyBulletHitPlayer(b, p),
      onEnemyHitPlayer: (e, p) => this._onEnemyHitPlayer(e, p),
      onPowerUpPickup: (pu, p) => this._onPowerUpPickup(pu, p),
      onBossBodyHitPlayer: (boss, p) => this._onBossBodyHitPlayer(boss, p),
    });

    this._achievements = new AchievementSystem(game, this._stats);

    // BOSS 召唤小怪
    this._bossSummonListener = eventBus.on('boss:summon', (payload) => {
      const data = payload as { x: number; y: number };
      this._spawnSummonedEnemies(data.x, data.y);
    });

    // 玩家射击音效
    this._shootListener = eventBus.on('player:shoot', () => {
      this.game.audio.playSfx('shoot');
    });

    this.game.audio.startBgm();
  }

  onEnter(): void {
    super.onEnter();
    this._ensureStars();
    this._phase = 'intro';
    this._introT = 0;
    eventBus.emit('level:start', { level: this._levelId });
  }

  onExit(): void {
    super.onExit();
    this._bossSummonListener();
    this._shootListener();
    this._achievements.destroy();
    this.game.audio.stopBgm();
    eventBus.clear();
  }

  // ============ 主循环 ============
  update(dt: number): void {
    switch (this._phase) {
      case 'intro':
        this._updateIntro(dt);
        break;
      case 'playing':
        this._updatePlaying(dt);
        break;
      case 'bossWarn':
        this._updateBossWarn(dt);
        break;
      case 'boss':
        this._updateBoss(dt);
        break;
      case 'cleared':
        this._updateCleared(dt);
        break;
      case 'dead':
        this._updateDead(dt);
        break;
    }
    this._hud.update(dt);
    this._achievements.update(dt);
    if (this._vignette > 0) this._vignette -= dt * 2;

    // 暂停检测
    if (this.game.input.consumePause() && (this._phase === 'playing' || this._phase === 'boss')) {
      this.game.pushPause();
    }
  }

  private _updateIntro(dt: number): void {
    this._introT += dt;
    this._particles.update(dt);
    if (this._introT >= 2) {
      this._phase = 'playing';
    }
  }

  private _updatePlaying(dt: number): void {
    this._difficulty.update(dt);
    this._levelTime += dt;
    this._hud.setLevelTime(this._getLevelDuration() - this._levelTime);

    // 生成敌机
    this._spawner.update(dt, (type, x, y, diff) => this._spawnEnemy(type, x, y, diff));

    this._updateEntities(dt);
    this._checkCollisions();

    // 检查是否进入 BOSS 战
    if (!this._endless && this._levelTime >= this._getLevelDuration()) {
      this._enterBossWarn();
    }
    // 无尽模式 5 分钟成就检测
    if (this._endless && this._levelTime >= 300) {
      this._achievements.onLevelComplete(this._levelId, true, this._levelTime / 60);
    }

    eventBus.emit('score:change', { score: this._score });
  }

  private _updateBossWarn(dt: number): void {
    this._bossWarnT += dt;
    // 清空剩余敌机
    this._updateEntities(dt);
    if (this._bossWarnT >= 2.5) {
      this._spawnBoss();
      this._phase = 'boss';
    }
  }

  private _updateBoss(dt: number): void {
    this._difficulty.update(dt);
    // BOSS 战时少量小怪
    if (chance(0.3 * dt)) {
      this._spawner.update(dt, (type, x, y, diff) => this._spawnEnemy(type, x, y, diff));
    }
    this._updateEntities(dt);
    this._checkCollisions();
    this._hud.setBossActive(true);

    if (this._boss && !this._boss.alive) {
      this._onBossDefeated();
    }
  }

  private _updateCleared(dt: number): void {
    this._clearedT += dt;
    this._particles.update(dt);
    this._bullets.update(dt, this.game.width, this.game.height);
    if (this._clearedT >= 2.5) {
      this._proceedAfterClear();
    }
  }

  private _updateDead(dt: number): void {
    this._deadT += dt;
    this._particles.update(dt);
    this._bullets.update(dt, this.game.width, this.game.height);
    for (const e of this._enemies) e.update(dt);
    if (this._deadT >= 1.5) {
      this._goGameOver(false);
    }
  }

  private _updateEntities(dt: number): void {
    this._player.update(dt);
    this._bullets.update(dt, this.game.width, this.game.height);
    this._particles.update(dt);

    // 敌机
    for (let i = this._enemies.length - 1; i >= 0; i--) {
      const e = this._enemies[i];
      e.setTarget(this._player.alive ? this._player.pos : null);
      e.update(dt);
      if (!e.alive) {
        if (e.suicide) {
          // 自爆机撞击玩家：先让玩家受伤，再处理击杀反馈
          this._playerTakeDamage();
          this._killEnemy(e, true);
        }
        this._enemies.splice(i, 1);
      } else if (e.isOffscreen(this.game.width, this.game.height, 60)) {
        this._enemies.splice(i, 1);
      }
    }

    // 道具
    for (let i = this._powerups.length - 1; i >= 0; i--) {
      const p = this._powerups[i];
      p.setPlayer(this._player.alive ? this._player.pos : null);
      p.update(dt);
      if (!p.alive || p.isOffscreen(this.game.width, this.game.height, 60)) {
        this._powerups.splice(i, 1);
      }
    }

    // BOSS
    if (this._boss) {
      this._boss.setTarget(this._player.alive ? this._player.pos : null);
      this._boss.update(dt);
    }

    // 更新追踪弹目标
    this._updateHomingTargets();
  }

  private _updateHomingTargets(): void {
    const targets: { pos: { x: number; y: number } }[] = [];
    for (const e of this._enemies) targets.push(e);
    if (this._boss && this._boss.alive) targets.push(this._boss);
    for (const b of this._bullets.active) {
      if (b.homing) {
        // 找最近目标
        let best: { x: number; y: number } | null = null;
        let bestD = Infinity;
        for (const t of targets) {
          const d = (t.pos.x - b.pos.x) ** 2 + (t.pos.y - b.pos.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = t.pos;
          }
        }
        b.target = best;
      }
    }
  }

  private _checkCollisions(): void {
    const playerBullets = this._bullets.active.filter((b) => b.owner === 'player');
    const enemyBullets = this._bullets.active.filter((b) => b.owner === 'enemy');
    this._collision.check({
      playerBullets,
      enemyBullets,
      enemies: this._enemies,
      powerups: this._powerups,
      player: this._player,
      boss: this._boss,
    });
  }

  // ============ 生成 ============
  private _spawnEnemy(type: EnemyTypeId, x: number, y: number, diff: number): Enemy {
    const e = new Enemy(type, x, y, this._bullets, diff);
    this._enemies.push(e);
    return e;
  }

  private _spawnSummonedEnemies(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const e = new Enemy('E2', x + range(-40, 40), y + 20, this._bullets, this._difficulty.difficulty);
      this._enemies.push(e);
    }
  }

  private _spawnBoss(): void {
    const theme = getBossTheme(this._levelId);
    this._boss = new Boss(theme, this.game.width / 2, this._bullets, this._particles);
    this.game.audio.playSfx('bossWarn');
    eventBus.emit('level:start', { boss: true });
  }

  // ============ 碰撞回调 ============
  private _onBulletHitEnemy(b: import('../entities/Bullet').Bullet, e: Enemy): void {
    const killed = e.takeDamage(b.damage);
    this._bullets.remove(b);
    this._particles.explode(b.pos.x, b.pos.y, PALETTE.primary, 4, 0.5);
    this.game.audio.playSfx('hit');
    if (killed) {
      this._killEnemy(e, false);
    }
  }

  private _onBulletHitBoss(b: import('../entities/Bullet').Bullet, boss: Boss): void {
    boss.takeDamage(b.damage);
    this._bullets.remove(b);
    this._particles.explode(b.pos.x, b.pos.y, boss.color, 3, 0.4);
    this.game.audio.playSfx('hit');
  }

  private _onEnemyBulletHitPlayer(b: import('../entities/Bullet').Bullet, p: Player): void {
    this._bullets.remove(b);
    this._playerTakeDamage();
  }

  private _onEnemyHitPlayer(e: Enemy, p: Player): void {
    // 敌机撞玩家：敌机死亡（自爆机由 update 流程处理），玩家受伤
    if (e.typeId !== 'E4') {
      e.takeDamage(999);
      this._killEnemy(e, false);
    }
    this._playerTakeDamage();
  }

  private _onBossBodyHitPlayer(boss: Boss, p: Player): void {
    this._playerTakeDamage();
  }

  /** 统一处理玩家受伤反馈（含死亡判定） */
  private _playerTakeDamage(): void {
    if (!this._player.alive) return;
    if (this._player.takeDamage(1)) {
      this._particles.explode(this._player.pos.x, this._player.pos.y, PALETTE.danger, 20, 1.5);
      this.game.audio.playSfx('damage');
      this._vignette = 1;
      this._hud.shake(10);
      if (!this._player.alive) this._onPlayerDeath();
    }
  }

  private _onPowerUpPickup(pu: PowerUp, p: Player): void {
    // 清屏道具：消灭所有敌机与敌弹
    if (pu.type === 'wipe') {
      this._clearScreen();
    }
    p.applyPowerUp(pu.type);
    pu.alive = false;
    this._addScore(50);
    this._particles.explode(pu.pos.x, pu.pos.y, pu.color, 12, 0.8);
    this.game.audio.playSfx('powerup');
    eventBus.emit('powerup:pickup', { type: pu.type });
  }

  /** 清屏：消灭所有敌机、清除所有敌弹（炸弹/清屏道具共用） */
  private _clearScreen(): void {
    for (const e of this._enemies) this._killEnemy(e, false);
    this._enemies.length = 0;
    for (const b of this._bullets.active) {
      if (b.owner === 'enemy') b.alive = false;
    }
    this._particles.explode(this._player.pos.x, this._player.pos.y, PALETTE.warning, 40, 2);
    this._hud.shake(15);
    this.game.audio.playSfx('bomb');
  }

  // ============ 死亡与掉落 ============
  private _killEnemy(e: Enemy, suicide: boolean): void {
    e.alive = false;
    const pts = Math.floor(e.score * this._player.scoreMultiplier);
    this._addScore(pts);
    this._stats.onKill();
    this._hud.setCombo(this._stats.combo);
    this._particles.explode(e.pos.x, e.pos.y, e.color, e.isElite ? 24 : 12, e.isElite ? 1.2 : 0.8);
    this.game.audio.playSfx('explosion');
    this._hud.shake(e.isElite ? 4 : 2);
    eventBus.emit('enemy:kill', { enemy: e });

    // 掉落道具
    const dropChance = e.isElite ? CONFIG.powerUp.eliteDropChance : CONFIG.powerUp.dropChance;
    if (chance(dropChance)) {
      const type = randomPowerUpType();
      this._powerups.push(new PowerUp(e.pos.x, e.pos.y, type));
    }
  }

  private _onBossDefeated(): void {
    if (!this._boss) return;
    const boss = this._boss;
    // 大爆炸 + 慢动作
    this.game.time.slowmo(0.3, 600);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this._particles.explode(
          boss.pos.x + range(-40, 40),
          boss.pos.y + range(-40, 40),
          boss.color,
          30,
          2,
        );
      }, i * 150);
    }
    this.game.audio.playSfx('explosion');
    this._addScore(5000 * this._levelId);
    this._stats.onBossKill();
    eventBus.emit('boss:kill', { boss });
    this._boss = null;
    this._phase = 'cleared';
    this._clearedT = 0;
    this._hud.setBossActive(false);
  }

  private _onPlayerDeath(): void {
    this._phase = 'dead';
    this._deadT = 0;
    this.game.audio.playSfx('gameOver');
    this.game.audio.stopBgm();
  }

  // ============ 流程推进 ============
  private _enterBossWarn(): void {
    this._phase = 'bossWarn';
    this._bossWarnT = 0;
    this.game.audio.playSfx('bossWarn');
  }

  private _proceedAfterClear(): void {
    if (this._endless) {
      // 无尽模式继续
      this._levelTime = 0;
      this._phase = 'playing';
      return;
    }
    // 记录通关
    this._achievements.onLevelComplete(this._levelId, false, 0);
    if (this._levelId >= MAX_LEVEL) {
      // 全部通关
      this._goGameOver(true);
    } else {
      // 下一关
      this._levelId++;
      this._levelTime = 0;
      this._phase = 'intro';
      this._introT = 0;
      this._hud.setLevel(this._levelId, false);
      this._spawner = new SpawnSystem(this._levelId, false);
      eventBus.emit('level:start', { level: this._levelId });
    }
  }

  private _goGameOver(victory: boolean): void {
    this._achievements.onLevelComplete(this._levelId, this._endless, this._levelTime / 60);
    this.game.changeScene('gameover', {
      score: this._score,
      level: this._levelId,
      kills: this._stats.kills,
      victory,
      endless: this._endless,
    });
  }

  // ============ 分数与工具 ============
  private _addScore(pts: number): void {
    this._score += pts;
    this._hud.setScore(this._score);
    this._stats.score = this._score;
  }

  private _getLevelDuration(): number {
    return getLevel(this._levelId).duration;
  }

  // ============ 渲染 ============
  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    // 背景
    this._renderBackground(ctx);

    if (this._phase === 'intro') {
      this._renderIntro(ctx);
      this._particles.render(ctx);
      this._renderHUD(ctx);
      return;
    }

    // 游戏对象
    this._powerups.forEach((p) => p.render(ctx));
    this._enemies.forEach((e) => e.render(ctx));
    if (this._boss) this._boss.render(ctx);
    if (this._player.alive) this._player.render(ctx);
    this._bullets.render(ctx);
    this._particles.render(ctx);

    // BOSS 警告
    if (this._phase === 'bossWarn') this._renderBossWarn(ctx);

    // 受击 vignette
    if (this._vignette > 0) this._renderVignette(ctx, this._vignette);

    // HUD
    this._renderHUD(ctx);

    // 成就 Toast
    this._achievements.render(ctx);
  }

  private _renderBackground(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    const level = getLevel(this._levelId);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, w, h);

    // 星空
    const t = this.game.time.elapsed;
    ctx.fillStyle = PALETTE.text;
    for (let i = 0; i < this._stars.length; i++) {
      const s = this._stars[i];
      const y = (s.y + t * s.s) % h;
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = PALETTE.bgGrid;
    ctx.lineWidth = 1;
    const gy = (t * 60) % 80;
    for (let y = -80 + gy; y < h; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private _stars: { x: number; y: number; r: number; s: number; a: number }[] = [];
  private _initStars(): void {
    const { width: w, height: h } = this.game;
    for (let i = 0; i < 100; i++) {
      this._stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        s: Math.random() * 60 + 20,
        a: 0.2 + Math.random() * 0.5,
      });
    }
  }

  private _renderIntro(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    const level = getLevel(this._levelId);
    const t = Math.min(1, this._introT / 0.5);
    const fadeOut = this._introT > 1.5 ? Math.max(0, 1 - (this._introT - 1.5) / 0.5) : 1;
    ctx.save();
    ctx.globalAlpha = easeOutCubic(t) * fadeOut;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.primary;
    ctx.shadowColor = PALETTE.primary;
    ctx.shadowBlur = 20;
    ctx.font = `bold 36px ${FONTS.title}`;
    ctx.fillText(level.name, w / 2, h / 2 - 20);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `16px ${FONTS.body}`;
    ctx.shadowBlur = 8;
    ctx.fillText(this._endless ? '无尽模式' : `LEVEL ${this._levelId}`, w / 2, h / 2 + 20);
    ctx.restore();
  }

  private _renderBossWarn(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    const blink = Math.floor(this._bossWarnT * 6) % 2 === 0;
    ctx.save();
    ctx.fillStyle = 'rgba(255,48,48,0.15)';
    ctx.fillRect(0, 0, w, h);
    if (blink) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PALETTE.danger;
      ctx.shadowColor = PALETTE.danger;
      ctx.shadowBlur = 25;
      ctx.font = `bold 44px ${FONTS.title}`;
      ctx.fillText('WARNING', w / 2, h / 2 - 20);
      ctx.font = `18px ${FONTS.body}`;
      ctx.fillStyle = PALETTE.warning;
      ctx.shadowColor = PALETTE.warning;
      ctx.fillText('BOSS 来袭', w / 2, h / 2 + 24);
    }
    // 扫描线
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = PALETTE.danger;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = (this._bossWarnT * 300 + i * 60) % h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private _renderVignette(ctx: CanvasRenderingContext2D, intensity: number): void {
    const { width: w, height: h } = this.game;
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.7);
    grad.addColorStop(0, 'rgba(255,48,48,0)');
    grad.addColorStop(1, `rgba(255,48,48,${0.5 * intensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private _renderHUD(ctx: CanvasRenderingContext2D): void {
    this._hud.render(ctx, this._player, this.game.width, this.game.height);
  }

  onKeyDown(key: string): void {
    // 炸弹
    if (key === 'x' && (this._phase === 'playing' || this._phase === 'boss')) {
      if (this._player.useBomb()) {
        this._useBomb();
      }
    }
  }

  private _useBomb(): void {
    this._clearScreen();
    // 残血用炸弹通关成就标记
    if (this._player.hp <= 1) this._stats.bombSaveCleared = true;
  }

  // onEnter 时初始化星空
  private _starsInited = false;
  protected _ensureStars(): void {
    if (!this._starsInited) {
      this._initStars();
      this._starsInited = true;
    }
  }
}
