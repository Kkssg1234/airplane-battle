/**
 * 数学与几何工具
 */
import type { Vec2, Rect, Circle, Bounds } from '../types';

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const rand = (min: number, max: number): number => min + Math.random() * (max - min);

export const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/** 角度转弧度 */
export const deg2rad = (d: number): number => (d * Math.PI) / 180;

/** 缓动函数 */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** 判断 bounds 是否为圆 */
export const isCircle = (b: Bounds): b is Circle => (b as Circle).r !== undefined;

/** 矩形 vs 矩形 */
export const rectIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** 圆 vs 圆 */
export const circleIntersect = (a: Circle, b: Circle): boolean =>
  dist2(a, b) < (a.r + b.r) * (a.r + b.r);

/** 矩形 vs 圆 */
export const rectCircleIntersect = (r: Rect, c: Circle): boolean => {
  const cx = clamp(c.x, r.x, r.x + r.w);
  const cy = clamp(c.y, r.y, r.y + r.h);
  return dist2({ x: cx, y: cy }, c) < c.r * c.r;
};

/** 通用 bounds 碰撞检测 */
export const boundsIntersect = (a: Bounds, b: Bounds): boolean => {
  const aC = isCircle(a), bC = isCircle(b);
  if (aC && bC) return circleIntersect(a, b);
  if (!aC && !bC) return rectIntersect(a, b);
  // 一个圆一个矩形
  return aC ? rectCircleIntersect(b as Rect, a) : rectCircleIntersect(a as Rect, b as Circle);
};

/** 向量归一化 */
export const normalize = (v: Vec2): Vec2 => {
  const m = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / m, y: v.y / m };
};

/** 限制角度到 [-180,180] */
export const wrapAngle = (a: number): number => {
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
};
