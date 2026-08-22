/**
 * 实体基类
 * 所有游戏对象（玩家、敌机、子弹、道具、粒子）继承此类
 */
import type { Bounds, Faction, Vec2 } from '../types';

export abstract class Entity {
  pos: Vec2;
  vel: Vec2 = { x: 0, y: 0 };
  radius = 10; // 默认碰撞半径
  faction: Faction = 'neutral';
  color = '#FFFFFF';
  alive = true;
  /** 是否在屏幕外可被剔除 */
  cullable = true;
  /** 生命值（敌机/玩家用，子弹为 1） */
  hp = 1;
  /** 受击闪烁计时 */
  hitFlash = 0;
  /** 旋转角度（用于绘制） */
  rotation = 0;

  constructor(x: number, y: number) {
    this.pos = { x, y };
  }

  /** 逻辑更新 */
  abstract update(dt: number, ctx?: unknown): void;

  /** 渲染 */
  abstract render(ctx: CanvasRenderingContext2D): void;

  /** 碰撞包围盒（默认圆形） */
  getBounds(): Bounds {
    return { x: this.pos.x, y: this.pos.y, r: this.radius };
  }

  /** 是否在屏幕外 */
  isOffscreen(w: number, h: number, margin = 100): boolean {
    return (
      this.pos.x < -margin ||
      this.pos.x > w + margin ||
      this.pos.y < -margin ||
      this.pos.y > h + margin
    );
  }

  /** 应用速度移动 */
  protected _applyVelocity(dt: number): void {
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }

  /** 受伤，返回是否死亡 */
  takeDamage(dmg: number): boolean {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }
}
