// Placeholder entry point. Plan 3 replaces this with the real renderer,
// input handling, and screens. For now it proves the page, the build, and
// the Pages deploy are alive.

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('canvas not found');
}

const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('2d context not available');
}

const { width, height } = canvas;

ctx.fillStyle = '#3b6b35';
ctx.fillRect(0, 0, width, height);

ctx.fillStyle = '#f2f2f2';
ctx.font = 'bold 48px monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Muddle & Mayhem', width / 2, height / 2);

const drawSoldier = (x: number, y: number, colour: string): void => {
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fillStyle = colour;
  ctx.fill();
};

drawSoldier(width * 0.25, height * 0.7, '#3d7bd6');
drawSoldier(width * 0.75, height * 0.7, '#d64545');
