/**
 * 入口：创建 Game 实例并启动
 */
import { Game } from './game/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const tip = document.getElementById('bootTip');

if (!canvas) {
  if (tip) tip.textContent = '错误: 找不到 canvas 元素';
  throw new Error('Canvas element #game not found');
}

const game = new Game(canvas);

game
  .start()
  .then(() => {
    if (tip) tip.style.display = 'none';
    console.log('[PlaneWar] 游戏已启动');
  })
  .catch((err) => {
    console.error('[PlaneWar] 启动失败', err);
    if (tip) tip.textContent = '启动失败，请刷新重试';
  });

// 暴露到全局便于调试
if (typeof window !== 'undefined') {
  (window as unknown as { __game?: Game }).__game = game;
}
