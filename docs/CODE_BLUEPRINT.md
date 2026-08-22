# 代码生成蓝图 - 快速参考索引

> 本文件为后续代码生成的**速查手册**，所有关键决策与数值集中于此，避免反复翻阅主文档。
> 主文档：[TECHNICAL_DESIGN.md](./TECHNICAL_DESIGN.md)

---

## 🎯 一句话定位

科技风格飞机大战网页小游戏 → **HTML5 Canvas 2D + TypeScript + Vite**，单人开发，3 周 MVP，模块化可扩展。

## ⚙️ 技术栈（固定，勿改）

| 项 | 选型 |
|----|------|
| 渲染 | HTML5 Canvas 2D |
| 语言 | TypeScript 5.x (strict) |
| 构建 | Vite 5.x |
| 测试 | Vitest |
| 存储 | LocalStorage（配置/进度）+ IndexedDB（排行榜） |
| 部署 | Vercel / GitHub Pages |

## 📁 目录骨架（代码生成时按此创建）

```
src/
├── main.ts              # 入口
├── game/                # Game, GameLoop, TimeManager
├── scenes/              # Scene基类 + Boot/Menu/Game/Pause/GameOver
├── entities/            # Entity基类 + Player/Enemy族/Bullet族/PowerUp/Boss/Particle
├── systems/             # Input/Collision/Audio/Asset/Spawn/Difficulty/Achievement
├── ui/                  # UIManager/HUD/widgets
├── data/                # StorageManager/config.ts/levels.ts
├── utils/               # math/pool/eventBus/random
└── types/               # 全局类型
```

## 🎨 视觉规范（写代码时直接用）

```typescript
const PALETTE = {
  bg:        '#05070F',
  primary:   '#00F0FF',  // 青
  accent:    '#FF2E88',  // 品红
  warning:   '#FFE600',  // 黄
  text:      '#E6F7FF',
  danger:    '#FF3030',
} as const;
const FONTS = {
  title: "'Orbitron', sans-serif",
  body:  "'Rajdhani', sans-serif",
  mono:  "'Share Tech Mono', monospace",
} as const;
```

## 📐 核心数值（config.ts 直接落地）

```typescript
export const CONFIG = {
  fps: 60,
  fixedDt: 1000 / 60,
  designWidth: 1080,
  designHeight: 1920,
  player: {
    speed: 360, slowSpeed: 144, accel: 0.15,
    maxHp: 3, initBombs: 2, maxWeaponLevel: 5,
  },
  bullet: { poolSize: 300 },
  particle: { maxCount: 500 },
  ranks: { topN: 50 },
  difficulty: {
    formula: (lvl, min, score) =>
      1 + 0.15 * (lvl - 1) + 0.02 * min + 0.0001 * score,
  },
} as const;
```

## 🎮 实体速查表

### 敌机
| ID | 名 | HP | 得分 | 模式 | 关卡 |
|----|----|----|------|------|------|
| E1 | 侦察机 | 1 | 100 | 直线 | 全 |
| E2 | 截击机 | 3 | 200 | 正弦 | 1+ |
| E3 | 重装机 | 8 | 500 | 横移 | 2+ |
| E4 | 自爆机 | 2 | 300 | 追踪 | 3+ |
| E5 | 护盾机 | 6 | 600 | 编队 | 4+ |
| E6 | 隐形机 | 4 | 800 | 隐身 | 5+ |

### 道具
`P`武器升级 · `S`护盾 · `M`得分加倍 · `B`炸弹 · `H`回血 · `W`清屏
掉率：普通 5% / 精英 30% / BOSS 必掉

### 武器等级
Lv1单发 → Lv2双发 → Lv3三发扇形 → Lv4三发+追踪 → Lv5五发+追踪

### BOSS（每关1个）
1.铁壁要塞 2.散射蜂巢 3.追踪猎手 4.编队指挥 5.幻影幽灵 6.终焉核心
阶段：100-66% / 66-33% / 33-0%（狂暴+弱点双倍）

## 🕹️ 操作映射

```
键盘: 方向键/WASD移动 | Shift低速 | 空格/Z射击 | X炸弹 | C切武器 | Esc/P暂停
鼠标: 移动跟随 | 左键射击
触摸: 拖动跟随 | 双指炸弹
```

## 🔌 关键接口契约（生成代码时遵守）

```typescript
interface Scene { update(dt:number):void; render(ctx:CanvasRenderingContext2D, alpha:number):void; }
interface Entity { update(dt:number):void; render(ctx:CanvasRenderingContext2D):void; getBounds():Rect|Circle; }
interface StorageManager { saveConfig(c:UserConfig):void; loadConfig():UserConfig; saveProgress(p:GameProgress):void; loadProgress():GameProgress; getRank():Promise<ScoreRecord[]>; addScore(r:ScoreRecord):Promise<void>; }
// 事件总线: on/emit/off  解耦系统
```

## 🚦 生成顺序建议

1. `config.ts` + `types/` + `utils/`（地基）
2. `Game` + `GameLoop` + `TimeManager` + `SceneManager` + `Scene`基类（引擎）
3. `BootScene` + `MenuScene`（能跑能点）
4. `Player` + `InputManager` + `GameScene`（能飞能射）
5. `Bullet` + `Enemy` + `CollisionSystem`（能打能死）
6. `PowerUp` + `SpawnSystem` + `DifficultyManager`（有挑战）
7. `Boss` + 关卡数据（有目标）
8. `UIManager` + `HUD` + `AudioManager` + `AssetManager`（有体验）
9. `StorageManager` + 排行榜 + `AchievementSystem`（有留存）
10. `GameOverScene` + `PauseScene` + 打磨特效（能完整玩）

## ✅ 验收基线

- 桌面 60FPS / 移动 30FPS+ / 内存<100MB / 首屏<3s
- 6 关 + 无尽模式可玩通
- 排行榜 Top50 + 8 成就可解锁
- Chrome/Edge/Firefox/Safari 桌面+移动兼容
