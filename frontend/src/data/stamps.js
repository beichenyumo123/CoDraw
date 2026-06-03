// 动森主题手帐印章 — 每个印章是一组 canvas 2D 绘制指令
// 所有印章在 40×40 的坐标系内设计，渲染时按 scale 缩放

const SIZE = 40; // 印章设计尺寸

export const STAMPS = [
  { id: 'leaf',      label: '🍃 树叶',   icon: '🍃' },
  { id: 'star',      label: '⭐ 星星',   icon: '⭐' },
  { id: 'fossil',    label: '🦴 化石',   icon: '🦴' },
  { id: 'bell',      label: '💰 铃钱',   icon: '💰' },
  { id: 'house',     label: '🏠 小房子', icon: '🏠' },
  { id: 'heart',     label: '❤️ 爱心',   icon: '❤️' },
  { id: 'fish',      label: '🎣 鱼',     icon: '🎣' },
  { id: 'butterfly', label: '🦋 蝴蝶',   icon: '🦋' },
];

// 在指定位置绘制指定印章
export function drawStamp(ctx, stampId, x, y, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = SIZE;
  const h = s / 2;

  switch (stampId) {
    case 'leaf':
      // 树叶 — 叶形 + 茎线
      ctx.beginPath();
      ctx.moveTo(h, 4);
      ctx.quadraticCurveTo(4, 12, 4, 24);
      ctx.quadraticCurveTo(11, 28, h, 34);
      ctx.quadraticCurveTo(29, 28, 36, 24);
      ctx.quadraticCurveTo(36, 12, h, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(h, 34);
      ctx.lineTo(h, s - 2);
      ctx.stroke();
      break;

    case 'star':
      // 五角星
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? h - 3 : h * 0.4;
        const px = h + Math.cos(angle) * r;
        const py = h + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;

    case 'fossil':
      // 化石 — 螺旋壳
      ctx.beginPath();
      ctx.arc(h, h + 3, h - 6, Math.PI, 0);
      ctx.arc(h, h + 3, (h - 6) * 0.5, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(h, 12, 8, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;

    case 'bell':
      // 铃钱袋 — 圆底 + 星星
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(h, 4);
      ctx.lineTo(s - 10, 10);
      ctx.quadraticCurveTo(s - 2, 22, h + 4, s - 2);
      ctx.quadraticCurveTo(2, 22, 10, 10);
      ctx.fill();
      // 小星星
      ctx.fillStyle = '#FFFFFF'; // 铃钱袋上的白星
      ctx.font = `${h}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', h, h + 2);
      break;

    case 'house':
      // 小房子
      ctx.beginPath();
      ctx.moveTo(h, 4);
      ctx.lineTo(4, 18);
      ctx.lineTo(8, 18);
      ctx.lineTo(8, s - 2);
      ctx.lineTo(s - 8, s - 2);
      ctx.lineTo(s - 8, 18);
      ctx.lineTo(s - 4, 18);
      ctx.closePath();
      ctx.fill();
      // 门
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(h - 5, s - 14, 10, 12);
      break;

    case 'heart':
      // 爱心
      ctx.beginPath();
      ctx.moveTo(h, s - 4);
      ctx.bezierCurveTo(2, h, 2, 6, h - 2, 6);
      ctx.bezierCurveTo(h + 2, 6, h + 2, 10, h, s - 4);
      ctx.fill();
      ctx.bezierCurveTo(h - 2, 10, h - 2, 6, h - 2, 6);
      break;

    case 'fish':
      // 鱼 — 椭圆 + 三角形尾巴
      ctx.beginPath();
      ctx.ellipse(h, h - 2, h - 4, h - 8, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s - 4, h - 2);
      ctx.lineTo(s - 2, h - 14);
      ctx.lineTo(s - 2, h + 10);
      ctx.closePath();
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(12, h - 4, 3, 0, 2 * Math.PI);
      ctx.fill();
      break;

    case 'butterfly':
      // 蝴蝶 — 对称翅膀
      ctx.beginPath();
      ctx.ellipse(h - 10, 12, 10, 13, -0.3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(h + 10, 12, 10, 13, 0.3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(h - 7, 30, 6, 8, 0.2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(h + 7, 30, 6, 8, -0.2, 0, 2 * Math.PI);
      ctx.fill();
      // 身体
      ctx.beginPath();
      ctx.moveTo(h, 6);
      ctx.lineTo(h, 34);
      ctx.lineWidth = 3;
      ctx.stroke();
      break;

    default:
      break;
  }

  ctx.restore();
}
