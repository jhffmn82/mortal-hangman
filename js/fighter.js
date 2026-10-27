// One fighter on the arena floor: plays its MK2 animations anchored on the feet, walks, takes hits.

// Frames per second for each animation, and how each one is pinned to the floor.
const FPS = { stance: 9, walk: 15, punch: 20, kick: 20, roundhouse: 18, uppercut: 16, hit: 14, fall: 12, dizzy: 8, victory: 8,
  fatality: 9, sp_throw: 14 };
const ANCHOR = { walk: 'center', fall: 'front' };
const LOOPING = new Set(['stance', 'walk', 'dizzy']);

// A tiny scheduler: promises that resolve on a later game tick, so fight choreography reads top to bottom.
const Clock = {
  now: 0,
  waits: [],
  until(cond) {
    return new Promise(resolve => this.waits.push({ cond, resolve }));
  },
  wait(seconds) {
    const end = this.now + seconds;
    return this.until(() => this.now >= end);
  },
  tick(dt) {
    this.now += dt;
    const ready = this.waits.filter(w => w.cond());
    if (!ready.length) return;
    this.waits = this.waits.filter(w => !ready.includes(w));
    for (const w of ready) w.resolve();
  },
  reset() {
    this.waits = [];
  },
};

class Fighter {
  constructor(slug, side) {
    this.slug = slug;
    this.def = ASSETS.fighters[slug];
    this.image = Images[this.def.image];
    this.side = side;
    this.dir = side === 0 ? 1 : -1;
    const s = this.def.anims.stance[0];
    this.stanceW = s[5] - s[4];
    this.height = s[3];
    this.centerOff = s[2] / 2 - s[4];
    this.home = side === 0 ? 118 - this.stanceW / 2 : 282 + this.stanceW / 2;
    this.x = this.home;
    this.health = this.shownHealth = this.lagHealth = 100;
    this.push = 0;
    this.visible = true;
    this.frozen = false;
    this.play('stance');
  }

  get female() {
    return this.def.female;
  }

  // Back to full health on the starting mark, for the next round.
  reset() {
    this.health = this.shownHealth = this.lagHealth = 100;
    this.x = this.home;
    this.target = null;
    this.push = 0;
    this.visible = true;
    this.frozen = false;
    this.play('stance');
  }

  // The fall frame where the fighter lies flat, before the get-up frames.
  get lyingFrame() {
    return Math.floor(this.def.anims.fall.length * 0.55);
  }

  play(anim, o = {}) {
    this.anim = anim;
    this.frames = this.def.anims[anim];
    this.t = 0;
    this.fps = o.fps || FPS[anim] || 12;
    this.loop = o.loop ?? LOOPING.has(anim);
    this.reverse = !!o.reverse;
    this.stopAt = o.stopAt ?? this.frames.length - 1;
    this.next = o.next === undefined ? (this.loop ? null : 'stance') : o.next;
  }

  get index() {
    let i = Math.floor(this.t * this.fps);
    if (this.loop) i %= this.frames.length;
    else i = Math.min(i, this.stopAt);
    return this.reverse ? this.frames.length - 1 - i : i;
  }

  get done() {
    return !this.loop && Math.floor(this.t * this.fps) >= this.stopAt + 1;
  }

  // The farthest any frame of an animation reaches in front of the back foot.
  reach(anim) {
    return Math.max(...this.def.anims[anim].map(r => r[2] - r[4]));
  }

  // The frame where an attack reaches farthest: that is when it connects.
  contactFrame(anim) {
    const frames = this.def.anims[anim];
    let best = 0;
    frames.forEach((r, i) => {
      if (r[2] - r[4] >= frames[best][2] - frames[best][4]) best = i;
    });
    return best;
  }

  // Where a blow lands on this fighter: the front of the chest.
  chest() {
    return { x: this.x - this.dir * this.stanceW * 0.62, y: GROUND - this.height * 0.74 };
  }

  walkTo(x, speed = 120) {
    this.target = x;
    this.walkSpeed = speed;
    if (Math.abs(x - this.x) < 1) {
      this.target = null;
      return Promise.resolve();
    }
    this.play('walk', { reverse: Math.sign(x - this.x) !== this.dir });
    return Clock.until(() => this.target === null);
  }

  hurt(amount, push) {
    this.health = Math.max(0, this.health - amount);
    this.push = push;
    this.hitFlash = 0.08;
  }

  update(dt) {
    this.t += dt;
    if (this.target !== null && this.target !== undefined) {
      const d = this.target - this.x;
      const step = this.walkSpeed * dt;
      if (Math.abs(d) <= step) {
        this.x = this.target;
        this.target = null;
        this.play('stance');
      } else {
        this.x += Math.sign(d) * step;
      }
    } else if (this.done && this.next && !this.frozen) {
      this.play(this.next);
    }
    this.push *= Math.pow(0.0005, dt);
    this.hitFlash = Math.max(0, (this.hitFlash || 0) - dt);
    // Green drops straight to the new health; the yellow trail catches up, as in MK2.
    this.shownHealth = this.health;
    if (this.lagHealth > this.health) this.lagHealth = Math.max(this.health, this.lagHealth - 40 * dt);
  }

  draw(ctx) {
    if (!this.visible) return;
    const r = this.frames[this.frozen ? this.frozenIndex : this.index];
    const [, , w, h, back, front] = r;
    const mode = ANCHOR[this.anim] || 'back';
    let a = back;
    let tx = this.x + this.push;
    if (mode === 'front') {
      a = front;
      tx += this.dir * this.stanceW;
    } else if (mode === 'center') {
      a = w / 2;
      tx += this.dir * this.centerOff;
    }
    const left = this.dir === 1 ? tx - a : tx - (w - 1 - a);
    const top = GROUND - h;
    blit(ctx, this.image, r, left, top, this.dir === -1);
    if (this.frozen) this.tint(ctx, r, left, top, 'rgba(120, 200, 255, 0.55)');
  }

  // Colour the sprite's own pixels (Sub-Zero's freeze) using an offscreen copy of the frame.
  tint(ctx, r, left, top, color) {
    const c = Fighter.scratch || (Fighter.scratch = document.createElement('canvas'));
    c.width = r[2];
    c.height = r[3];
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    blit(g, this.image, r, 0, 0, this.dir === -1);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(c, Math.round(left), Math.round(top));
  }

  freeze(on) {
    this.frozen = on;
    if (on) this.frozenIndex = this.index;
  }
}
