/**
 * 随机工具
 */

/** 0-1 随机 */
export const random = (): number => Math.random();

/** 概率命中 [0,1] */
export const chance = (p: number): boolean => Math.random() < p;

/** 数组随机取一个 */
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** 按权重随机选取 */
export const pickWeighted = <T>(items: readonly { item: T; weight: number }[]): T => {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
};

/** 区间随机浮点 */
export const range = (min: number, max: number): number => min + Math.random() * (max - min);

/** 区间随机整数 [min,max] */
export const rangeInt = (min: number, max: number): number =>
  Math.floor(min + Math.random() * (max - min + 1));
