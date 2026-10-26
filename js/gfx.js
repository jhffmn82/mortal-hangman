// Drawing: the 400x254 MK2 screen, sprite frames, MK2 text and the themed word window.

const W = 400;
const H = 254;
const GROUND = 236;
const GOLD = ['#fff6b0', '#f4c542', '#a8650c'];

const Images = {};

function loadImages(paths) {
  return Promise.all([...new Set(paths)].map(p => new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => { Images[p] = im; resolve(); };
    im.onerror = () => reject(new Error('could not load ' + p));
    im.src = p;
  })));
}

// Draw one atlas rect [x, y, w, h, ...] with its top-left at (x, y); flip mirrors it in place.
function blit(ctx, image, r, x, y, flip, scale = 1) {
  const w = r[2] * scale;
  const h = r[3] * scale;
  if (!flip) {
    ctx.drawImage(image, r[0], r[1], r[2], r[3], Math.round(x), Math.round(y), w, h);
    return;
  }
  ctx.save();
  ctx.translate(Math.round(x) + w, Math.round(y));
  ctx.scale(-1, 1);
  ctx.drawImage(image, r[0], r[1], r[2], r[3], 0, 0, w, h);
  ctx.restore();
}

function prop(group, id) {
  return ASSETS.props.items[group][id];
}

function drawProp(ctx, group, id, cx, cy, scale = 1, alpha = 1) {
  const r = prop(group, id);
  if (!r) return;
  ctx.globalAlpha = alpha;
  blit(ctx, Images[ASSETS.props.image], r, cx - (r[2] * scale) / 2, cy - (r[3] * scale) / 2, false, scale);
  ctx.globalAlpha = 1;
}

// MK2-font text. Options: size, color (or 'gold' for the gradient), align, shadow, font, alpha.
function text(ctx, str, x, y, o = {}) {
  const size = o.size || 8;
  ctx.font = `${size}px ${o.font || 'MK2'}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.shadow !== false) {
    ctx.fillStyle = o.shadow || '#000';
    ctx.fillText(str, x + size / 10 + 0.4, y + size / 10 + 0.4);
  }
  if (o.color === 'gold') {
    const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y);
    g.addColorStop(0, GOLD[0]);
    g.addColorStop(0.45, GOLD[1]);
    g.addColorStop(1, GOLD[2]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = o.color || '#fff';
  }
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}

function textWidth(ctx, str, size, font = 'MK2') {
  ctx.font = `${size}px ${font}`;
  return ctx.measureText(str).width;
}

function wrap(ctx, str, maxWidth, size) {
  const words = str.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (line && textWidth(ctx, next, size) > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// The MK2-style window: dark blood-red glass in a bronze frame with dragon medallions.
function panel(ctx, x, y, w, h, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, 'rgba(48, 4, 4, 0.88)');
  fill.addColorStop(1, 'rgba(8, 0, 0, 0.88)');
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  const rim = ctx.createLinearGradient(0, y, 0, y + h);
  rim.addColorStop(0, '#f8de7e');
  rim.addColorStop(0.5, '#b07a1c');
  rim.addColorStop(1, '#5a3608');
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 230, 150, 0.35)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 2.2, y + 2.2, w - 4.4, h - 4.4);
  ctx.restore();
  const medal = prop('hud', '0002');
  if (medal) {
    for (const mx of [x, x + w]) blit(ctx, Images[ASSETS.props.image], medal, mx - medal[2] / 2, y - medal[3] / 2 + 1, false);
  }
}

// MK2 health bar: red under green, a light rim, the fighter's name label laid over it.
function healthBar(ctx, f, x, y, w, rightAligned) {
  const h = 11;
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#9c0000';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  const shown = Math.max(0, f.shownHealth) / 100;
  const lag = Math.max(0, f.lagHealth) / 100;
  const inner = w - 2;
  ctx.fillStyle = '#e8d24a';
  if (rightAligned) ctx.fillRect(x + 1 + inner * (1 - lag), y + 1, inner * lag, h - 2);
  else ctx.fillRect(x + 1, y + 1, inner * lag, h - 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#5cff4a');
  g.addColorStop(0.5, '#16b812');
  g.addColorStop(1, '#0a6a08');
  ctx.fillStyle = g;
  if (rightAligned) ctx.fillRect(x + 1 + inner * (1 - shown), y + 1, inner * shown, h - 2);
  else ctx.fillRect(x + 1, y + 1, inner * shown, h - 2);
  const label = prop('text', f.def.label);
  if (label) {
    const lx = rightAligned ? x + w - label[2] - 3 : x + 3;
    blit(ctx, Images[ASSETS.props.image], label, lx, y + (h - label[3]) / 2 + 0.5, false);
  }
}
