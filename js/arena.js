// An MK2 arena: the backdrop with its animated pieces (tree faces, monks, crowds, lava, bats, acid).

const ARENA_NAMES = Object.keys(ASSETS.arenas);

function cycle(t, fps, n, mode) {
  const i = Math.floor(t * fps);
  if (mode === 'pingpong' && n > 1) {
    const p = i % (2 * n - 2);
    return p < n ? p : 2 * n - 2 - p;
  }
  return i % n;
}

class Arena {
  constructor(name) {
    this.name = name;
    this.def = ASSETS.arenas[name];
    this.t = 0;
    this.flyers = [];
    this.bubbles = [];
    this.nextFlyer = 1 + Math.random() * 3;
    this.nextBubble = 0.5;
  }

  update(dt) {
    this.t += dt;
    const fly = this.def.flyer;
    if (fly && (this.nextFlyer -= dt) <= 0) {
      this.nextFlyer = fly.every[0] + Math.random() * (fly.every[1] - fly.every[0]);
      const right = Math.random() < 0.5;
      this.flyers.push({ x: right ? -50 : W + 50, y: fly.y[0] + Math.random() * (fly.y[1] - fly.y[0]),
        vx: (right ? 1 : -1) * (45 + Math.random() * 35), t: Math.random() });
    }
    for (const f of this.flyers) {
      f.x += f.vx * dt;
      f.t += dt;
    }
    this.flyers = this.flyers.filter(f => f.x > -80 && f.x < W + 80);

    const bub = this.def.bubbles;
    if (bub && (this.nextBubble -= dt) <= 0) {
      this.nextBubble = bub.every[0] + Math.random() * (bub.every[1] - bub.every[0]);
      this.bubbles.push({ x: 15 + Math.random() * (W - 30), y: bub.y[0] + Math.random() * (bub.y[1] - bub.y[0]), t: 0 });
    }
    for (const b of this.bubbles) b.t += dt;
    if (bub) this.bubbles = this.bubbles.filter(b => b.t * bub.fps < bub.frames.length);
  }

  draw(ctx) {
    ctx.drawImage(Images[this.def.image], 0, 0);
    const anim = Images[this.def.anim];
    for (const o of this.def.overlays) {
      const r = o.frames[cycle(this.t, o.fps, o.frames.length, o.mode)];
      const top = o.top ?? o.bottom - r[3];
      if (o.clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, o.clip[0], W, o.clip[1] - o.clip[0]);
        ctx.clip();
      }
      blit(ctx, anim, r, o.cx - r[2] / 2, top, o.flip);
      if (o.clip) ctx.restore();
    }
    const fly = this.def.flyer;
    for (const f of this.flyers) {
      const r = fly.frames[cycle(f.t, fly.fps, fly.frames.length, 'loop')];
      blit(ctx, anim, r, f.x - r[2] / 2, f.y - r[3] / 2, f.vx < 0);
    }
    const bub = this.def.bubbles;
    for (const b of this.bubbles) {
      const r = bub.frames[Math.min(bub.frames.length - 1, Math.floor(b.t * bub.fps))];
      blit(ctx, anim, r, b.x - r[2] / 2, b.y - r[3], false);
    }
  }
}
