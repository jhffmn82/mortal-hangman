// Blood, gore, projectiles and one-shot sprite effects, all on the arena floor at GROUND.

const BLOOD_DROPS = ['0121', '0122', '0123', '0124', '0125', '0126', '0127', '0128', '0213', '0214', '0215', '0241', '0242', '0243'];
const BLOOD_SPLATS = ['0175', '0176', '0180', '0181', '0182', '0183', '0184', '0185'];
const BLOOD_SPURT = ['0159', '0160', '0161', '0162', '0163', '0164', '0165', '0166', '0167', '0168', '0169', '0170'];
const GRAVITY = 520;
const ICE = new Set(['0477', '0488', '0489', '0490', '0491', '0492', '0493', '0494']); // Sub-Zero's frozen chunks

function pickOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

class Effects {
  constructor() {
    this.parts = [];   // flying pieces: blood drops and body parts
    this.splats = [];  // blood on the floor
    this.anims = [];   // one-shot sprite animations (spurts, projectile impacts)
    this.shots = [];   // projectiles in flight
  }

  // A burst of drops flying away from a hit, plus a spurt at the point of impact.
  blood(x, y, dir, count) {
    const props = ASSETS.props.items.blood;
    for (let i = 0; i < count; i++) {
      this.parts.push({
        image: Images[ASSETS.props.image], r: props[pickOf(BLOOD_DROPS)],
        x, y, vx: dir * (15 + Math.random() * 75) + (Math.random() - 0.5) * 30, vy: -70 - Math.random() * 190, blood: true, flip: dir < 0,
      });
    }
    this.anim(Images[ASSETS.props.image], BLOOD_SPURT.map(id => props[id]), x + dir * 6, y, 24, dir < 0, 1, true);
  }

  // The whole body comes apart: the victim's own body parts, bones from the prop set and a lot of blood.
  explode(f) {
    const cx = f.x - f.dir * f.stanceW * 0.5;
    const top = GROUND - f.height;
    // Only the small pieces: MK2's big ones are fatality-specific halves and slices of the whole body.
    const own = shuffle(f.def.anims.gibs.filter(r => Math.max(r[2], r[3]) <= 44)).slice(0, 12);
    for (const r of own) {
      this.parts.push({ image: f.image, r, x: cx + (Math.random() - 0.5) * 30, y: top + Math.random() * f.height * 0.8,
        vx: (Math.random() - 0.5) * 320, vy: -120 - Math.random() * 260, flip: Math.random() < 0.5, bounces: 1 });
    }
    const gore = ASSETS.props.items.gore;
    const bones = Object.keys(gore).filter(id => !ICE.has(id) && Math.max(gore[id][2], gore[id][3]) <= 48);
    for (const id of shuffle(bones).slice(0, 12)) {
      this.parts.push({ image: Images[ASSETS.props.image], r: gore[id], x: cx + (Math.random() - 0.5) * 20,
        y: top + Math.random() * f.height * 0.7, vx: (Math.random() - 0.5) * 360, vy: -100 - Math.random() * 300,
        flip: Math.random() < 0.5, bounces: 1 });
    }
    for (let i = 0; i < 4; i++) this.blood(cx + (Math.random() - 0.5) * 30, top + 20 + Math.random() * 60, i % 2 ? 1 : -1, 16);
  }

  // offsets: the frames are props carrying MK2's per-frame drawing offset in r[4], r[5].
  anim(image, frames, x, y, fps, flip, scale = 1, offsets = false) {
    this.anims.push({ image, frames, x, y, fps, flip, t: 0, scale, offsets });
  }

  shoot(shot) {
    this.shots.push(shot);
    return shot;
  }

  update(dt) {
    for (const p of this.parts) {
      if (p.rest) continue;
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y >= GROUND - 2) {
        if (p.blood) {
          p.dead = true;
          if (Math.random() < 0.5) this.splats.push({ r: ASSETS.props.items.blood[pickOf(BLOOD_SPLATS)], x: p.x, life: 6 });
        } else if (p.bounces > 0) {
          p.bounces--;
          p.y = GROUND - 2;
          p.vy *= -0.35;
          p.vx *= 0.5;
        } else {
          p.y = GROUND - 2;
          p.rest = true;
        }
      }
    }
    this.parts = this.parts.filter(p => !p.dead);
    for (const s of this.splats) s.life -= dt;
    this.splats = this.splats.filter(s => s.life > 0);
    for (const a of this.anims) a.t += dt;
    this.anims = this.anims.filter(a => a.t * a.fps < a.frames.length);
    for (const s of this.shots) {
      s.t += dt;
      s.x += s.vx * dt;
    }
  }

  clear() {
    this.parts = [];
    this.splats = [];
  }

  draw(ctx) {
    const sheet = Images[ASSETS.props.image];
    for (const s of this.splats) {
      ctx.globalAlpha = Math.min(1, s.life);
      blit(ctx, sheet, s.r, s.x - s.r[2] / 2, GROUND - s.r[3] + 1, false);
    }
    ctx.globalAlpha = 1;
    for (const p of this.parts) blit(ctx, p.image, p.r, p.x - p.r[2] / 2, p.y - p.r[3] / 2, p.flip);
    for (const a of this.anims) {
      const r = a.frames[Math.min(a.frames.length - 1, Math.floor(a.t * a.fps))];
      const dx = a.offsets ? (a.flip ? -r[4] : r[4]) : 0;
      const dy = a.offsets ? r[5] : 0;
      blit(ctx, a.image, r, a.x + dx - (r[2] * a.scale) / 2, a.y + dy - (r[3] * a.scale) / 2, a.flip, a.scale);
    }
    for (const s of this.shots) s.draw(ctx);
  }
}
