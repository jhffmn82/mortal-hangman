// The title screen and MK2's CHOOSE YOUR FIGHTER grid.

const SELECT_GRID = [
  ['liukang', 'kunglao', 'johnnycage', 'reptile'],
  ['subzero', 'shangtsung', 'kitana', 'jax'],
  ['mileena', 'baraka', 'scorpion', 'raiden'],
];
const LEVELS = ['EASY', 'NORMAL', 'HARD'];

function backdrop(ctx, t) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 260);
  g.addColorStop(0, '#3a0606');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const medal = prop('hud', '0094');
  ctx.globalAlpha = 0.18 + 0.05 * Math.sin(t * 1.5);
  blit(ctx, Images[ASSETS.props.image], medal, W / 2 - medal[2] * 1.5, H / 2 - medal[3] * 1.5, false, 3);
  ctx.globalAlpha = 1;
}

class Title {
  constructor(opts = {}) {
    this.t = 0;
    this.item = 0;
    this.opts = { level: 'NORMAL', ...opts };
    Keyboard.show(false);
  }

  get items() {
    return ['1 PLAYER VS CPU', '2 PLAYERS', `CPU SKILL: ${this.opts.level}`];
  }

  onKey(key) {
    if (key === 'ArrowUp') this.item = (this.item + 2) % 3;
    else if (key === 'ArrowDown') this.item = (this.item + 1) % 3;
    else if ((key === 'ArrowLeft' || key === 'ArrowRight') && this.item === 2) this.cycleLevel(key === 'ArrowRight' ? 1 : 2);
    else if (key === 'Enter' || key === ' ') {
      if (this.item === 2) return this.cycleLevel(1);
      Sound.play('select');
      Game.show(new Select({ ...this.opts, players: this.item === 0 ? 1 : 2 }));
      return;
    } else return;
    Sound.play('cursor');
  }

  cycleLevel(step) {
    this.opts.level = LEVELS[(LEVELS.indexOf(this.opts.level) + step) % 3];
    Sound.play('cursor');
  }

  onClick(x, y) {
    const i = Math.floor((y - 150) / 16);
    if (i >= 0 && i < 3) {
      this.item = i;
      this.onKey('Enter');
    }
  }

  update(dt) {
    this.t += dt;
  }

  draw(ctx) {
    backdrop(ctx, this.t);
    text(ctx, 'MORTAL', W / 2, 74, { size: 40, align: 'center', color: 'gold', font: 'MKTitle', shadow: '#600' });
    text(ctx, 'HANGMAN', W / 2, 118, { size: 40, align: 'center', color: 'gold', font: 'MKTitle', shadow: '#600' });
    text(ctx, 'AN EDUCATIONAL FIGHTING GAME', W / 2, 134, { size: 7, align: 'center', color: '#c33' });
    this.items.forEach((label, i) => {
      const sel = i === this.item;
      text(ctx, (sel ? '> ' : '') + label + (sel ? ' <' : ''), W / 2, 160 + i * 16, { size: 10, align: 'center', color: sel ? 'gold' : '#888' });
    });
    if (Math.floor(this.t * 2) % 2 === 0) text(ctx, 'PRESS ENTER', W / 2, 222, { size: 8, align: 'center', color: '#fff' });
    text(ctx, 'Sprites and sounds: Mortal Kombat II (Midway, 1993) via MK Warehouse', W / 2, 246, { size: 5, align: 'center', color: '#666', shadow: false });
  }
}

class Select {
  constructor(opts) {
    this.opts = opts;
    this.t = 0;
    this.cursor = [[0, 0], [0, 3]];
    this.picks = [null, null];
    this.who = 0;
    this.locked = false;
    this.deck = opts.deck || new WordDeck(WORDS);
    this.previews = [new Fighter('liukang', 0), new Fighter('reptile', 1)];
    this.syncPreview(0);
    this.syncPreview(1);
    Keyboard.show(false);
    Sound.music('selectMusic', 0.45);
  }

  slugAt(c) {
    return SELECT_GRID[c[0]][c[1]];
  }

  syncPreview(i) {
    const slug = this.slugAt(this.cursor[i]);
    if (this.previews[i].slug !== slug) this.previews[i] = new Fighter(slug, i);
    this.previews[i].x = i === 0 ? 52 - this.previews[i].stanceW / 2 : W - 52 + this.previews[i].stanceW / 2;
  }

  onKey(key) {
    if (this.locked) return;
    const c = this.cursor[this.who];
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[key]) {
      c[0] = (c[0] + moves[key][0] + 3) % 3;
      c[1] = (c[1] + moves[key][1] + 4) % 4;
      this.syncPreview(this.who);
      Sound.play('cursor');
    } else if (key === 'Enter' || key === ' ') {
      this.choose();
    } else if (key === 'Escape') {
      Game.show(new Title(this.opts));
    }
  }

  onClick(x, y) {
    const cell = this.cellAt(x, y);
    if (!cell || this.locked) return;
    this.cursor[this.who] = cell;
    this.syncPreview(this.who);
    this.choose();
  }

  cellAt(x, y) {
    const { x0, y0, cw, ch } = this.layout();
    const col = Math.floor((x - x0) / cw);
    const row = Math.floor((y - y0) / ch);
    return row >= 0 && row < 3 && col >= 0 && col < 4 ? [row, col] : null;
  }

  layout() {
    const cw = 57;
    const ch = 70;
    return { cw, ch, x0: W / 2 - 2 * cw, y0: 33 };
  }

  choose() {
    const slug = this.slugAt(this.cursor[this.who]);
    this.picks[this.who] = slug;
    Sound.play('select');
    Sound.play(`name_${slug}`);
    if (this.who === 0 && this.opts.players === 2) {
      this.who = 1;
      return;
    }
    if (this.who === 0) this.run(this.cpuPick());
    else this.run(this.start());
  }

  run(p) {
    p.catch(err => console.error(err));
  }

  async cpuPick() {
    this.locked = true;
    this.who = 1;
    const choices = SELECT_GRID.flat().filter(s => s !== this.picks[0]);
    const final = pickOf(choices);
    for (let i = 0; i < 10; i++) {
      const s = i === 9 ? final : pickOf(choices);
      const row = SELECT_GRID.findIndex(r => r.includes(s));
      this.cursor[1] = [row, SELECT_GRID[row].indexOf(s)];
      this.syncPreview(1);
      Sound.play('cursor', 0.5);
      await Clock.wait(0.08 + i * 0.02);
    }
    this.picks[1] = final;
    await Clock.wait(0.5);
    Sound.play(`name_${final}`);
    await this.start();
  }

  async start() {
    this.locked = true;
    await Clock.wait(1.3);
    Sound.stopMusic();
    Game.show(new Fight({ ...this.opts, p1: this.picks[0], p2: this.picks[1], deck: this.deck,
      cpu: [false, this.opts.players === 1] }));
  }

  update(dt) {
    this.t += dt;
    for (const p of this.previews) p.update(dt);
  }

  draw(ctx) {
    backdrop(ctx, this.t);
    text(ctx, 'CHOOSE YOUR FIGHTER', W / 2, 26, { size: 15, align: 'center', color: 'gold', font: 'MKTitle', shadow: '#600' });
    const sheet = Images[ASSETS.props.image];
    const { x0, y0, cw, ch } = this.layout();
    SELECT_GRID.forEach((row, r) => row.forEach((slug, c) => {
      const p = prop('hud', ASSETS.fighters[slug].portrait);
      blit(ctx, sheet, p, x0 + c * cw + 1, y0 + r * ch, false);
    }));
    const blink = Math.floor(this.t * 6) % 2 === 0;
    for (const i of [0, 1]) {
      if (i === 1 && this.who === 0 && !this.picks[1]) continue;
      const [r, c] = this.cursor[i];
      const picked = this.picks[i];
      if (!picked && !blink && this.who === i) continue;
      ctx.strokeStyle = i === 0 ? '#ff2020' : '#2a6bff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + c * cw + 2, y0 + r * ch + 1, 53, 68);
      text(ctx, i === 0 ? '1P' : this.opts.players === 1 ? 'CPU' : '2P', x0 + c * cw + (i === 0 ? 4 : 52), y0 + r * ch + 8,
        { size: 6, align: i === 0 ? 'left' : 'right', color: i === 0 ? '#ff4040' : '#5a8cff' });
    }
    for (const i of [0, 1]) {
      if (i === 1 && this.who === 0 && !this.picks[1]) continue;
      const f = this.previews[i];
      f.draw(ctx);
      text(ctx, f.def.name, i === 0 ? 52 : W - 52, GROUND + 10, { size: 7, align: 'center', color: 'gold' });
    }
    const hint = this.locked ? '' : this.opts.players === 2 ? `PLAYER ${this.who + 1}: ARROWS TO MOVE, ENTER TO PICK` : 'ARROWS TO MOVE, ENTER TO PICK';
    text(ctx, hint, W / 2, 251, { size: 5, align: 'center', color: '#aaa' });
  }
}
