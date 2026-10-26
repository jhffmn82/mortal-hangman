// The fight: two fighters share one SAT word. A right letter is a punch (a kick on a streak), the
// letter that completes the word is a special move, a wrong letter passes the turn. Empty a health
// bar and the winner gets one fresh word to earn the fatality.

const DAMAGE = { punch: 10, kick: 15, special: 20 };
const FATALITY_MISSES = 3;
const PRAISE = ['excellent', 'outstanding', 'superb', 'welldone'];

class Fight {
  constructor(opts) {
    this.opts = opts;
    this.arena = new Arena(opts.arena || pickOf(ARENA_NAMES));
    this.fighters = [new Fighter(opts.p1, 0), new Fighter(opts.p2, 1)];
    this.cpu = opts.cpu;
    this.fx = new Effects();
    this.deck = opts.deck;
    this.turn = Math.random() < 0.5 ? 0 : 1;
    this.streak = 0;
    this.round = null;
    this.state = 'intro';
    this.finishing = false;
    this.missesLeft = 0;
    this.banners = [];
    this.note = null;
    this.dim = 0;
    this.dimTarget = 0;
    this.shake = 0;
    this.solvedFlash = 0;
    Keyboard.show(true);
    Keyboard.reset();
  }

  enter() {
    this.run(this.intro());
  }

  run(promise) {
    promise.catch(err => console.error(err));
  }

  player(i) {
    return this.cpu[i] ? 'CPU' : this.cpu[1 - i] ? 'YOU' : `PLAYER ${i + 1}`;
  }

  async intro() {
    await Clock.wait(0.5);
    this.banner({ prop: '0311' }, 1.3);
    Sound.play('fight');
    await Clock.wait(1.4);
    const first = this.fighters[this.turn];
    this.setNote(`COIN TOSS: ${first.def.name} GUESSES FIRST`, 2);
    this.newWord();
    this.awaitTurn();
  }

  newWord() {
    this.round = this.deck.next();
    Keyboard.reset();
  }

  awaitTurn() {
    this.state = 'input';
    Keyboard.enable(!this.cpu[this.turn]);
    if (this.cpu[this.turn]) this.run(this.cpuTurn());
  }

  async cpuTurn() {
    const round = this.round;
    await Clock.wait(0.9 + Math.random() * 1.1);
    if (this.state !== 'input' || this.round !== round) return;
    this.guess(cpuGuess(this.round, this.deck.words, this.opts.level));
  }

  onKey(key) {
    if (this.state === 'over' && (key === 'Enter' || key === ' ')) {
      Game.show(new Select(this.opts));
      return;
    }
    if (this.state === 'input' && !this.cpu[this.turn] && /^[A-Z]$/.test(key)) this.guess(key);
  }

  guess(letter) {
    const result = this.round.guess(letter);
    if (result === 'repeat') {
      Sound.play('buzz');
      this.setNote(`"${letter}" WAS ALREADY GUESSED`, 1.2);
      return;
    }
    Keyboard.mark(letter, result === 'hit');
    this.state = 'busy';
    Keyboard.enable(false);
    this.run(this.finishing ? this.fatalityGuess(letter, result) : this.fightGuess(letter, result));
  }

  async fightGuess(letter, result) {
    const me = this.fighters[this.turn];
    const foe = this.fighters[1 - this.turn];
    if (result === 'miss') {
      this.streak = 0;
      Sound.play('miss');
      if (Math.random() < 0.3) Sound.play('taunt');
      this.setNote(`NO "${letter}" - ${foe.def.name}'S TURN`, 1.6);
      await Clock.wait(1.1);
      this.turn = 1 - this.turn;
      this.awaitTurn();
      return;
    }
    Sound.play('reveal');
    this.streak++;
    if (this.round.solved) {
      this.solvedFlash = 1;
      Sound.play(pickOf(PRAISE));
      await this.special(me, foe);
    } else {
      if (this.streak >= 2) this.setNote(`${this.streak} IN A ROW - KICK!`, 1.4);
      await this.strike(me, foe, this.streak >= 2 ? 'kick' : 'punch');
    }
    if (foe.health <= 0) {
      await this.finishHim(me, foe);
      return;
    }
    if (this.round.solved) {
      await Clock.wait(0.8);
      this.solvedFlash = 0;
      this.newWord();
    }
    this.awaitTurn();
  }

  // Walk in, punch or kick, walk back.
  async strike(att, vic, kind) {
    const gap = att.reach(kind) + vic.stanceW * 0.62 - 10;
    await att.walkTo(vic.x - att.dir * gap);
    att.play(kind, { next: null });
    if (Math.random() < 0.6) Sound.play(att.female ? 'femaleAttack' : 'maleAttack', 0.8);
    Sound.play('swing', 0.7);
    await Clock.until(() => att.index >= att.frames.length - 1);
    this.land(vic, DAMAGE[kind], att.dir, kind === 'kick' ? 'kickHit' : 'punchHit', kind === 'kick' ? 14 : 9);
    if (kind === 'kick' && this.streak >= 3 && Math.random() < 0.35) this.toasty();
    await Clock.wait(0.14);
    att.play(kind, { reverse: true, next: null });
    await Clock.until(() => att.done);
    await att.walkTo(att.home);
  }

  // One blow lands: damage, blood, the thud and the victim's grunt.
  land(vic, damage, dir, sound, blood) {
    const c = vic.chest();
    vic.hurt(damage, dir * 9);
    vic.play('hit');
    this.fx.blood(c.x, c.y - 4, dir, blood);
    Sound.play(sound);
    Sound.play(vic.female ? 'femaleHurt' : 'maleHurt', 0.9);
    this.shake = Math.max(this.shake, damage >= 15 ? 0.25 : 0.12);
  }

  // The word is complete: the guesser's MK2 special move.
  async special(att, vic) {
    const sp = att.def.special;
    att.play('sp_throw', { next: null });
    Sound.play(`${att.slug}Special`) || Sound.play(att.female ? 'femaleAttack' : 'maleAttack');
    await Clock.until(() => att.done);
    const last = att.frames[att.frames.length - 1];
    const hand = { x: att.x + att.dir * (last[2] - last[4] - 8), y: GROUND - att.height * 0.66 };
    const target = vic.chest();
    Sound.play(sp.spear ? 'spear' : 'projectile');
    const shot = this.fx.shoot(sp.spear ? spearShot(att, hand) : projectile(att, hand));
    await Clock.until(() => att.dir * (shot.tip() - target.x) >= 0);
    this.fx.shots = this.fx.shots.filter(s => s !== shot);
    if (att.def.anims.sp_impact) {
      this.fx.anim(att.image, att.def.anims.sp_impact, target.x, target.y, 16, att.dir < 0);
    }
    if (sp.spear) {
      Sound.play('getOverHere');
      vic.hurt(10, 0);
      vic.play('hit', { next: 'dizzy' });
      this.fx.blood(target.x, target.y, att.dir, 10);
      Sound.play('punchHit');
      const pullTo = att.x + att.dir * (att.reach('uppercut') + vic.stanceW * 0.62 - 12);
      await vic.walkTo(pullTo, 260);
      vic.play('dizzy');
      await Clock.wait(0.5);
      await this.uppercut(att, vic, 10);
    } else if (sp.freeze) {
      Sound.play('freeze');
      vic.hurt(10, 0);
      vic.play('hit', { next: null });
      vic.freeze(true);
      await Clock.wait(0.5);
      const gap = att.reach('uppercut') + vic.stanceW * 0.62 - 12;
      await att.walkTo(vic.x - att.dir * gap);
      vic.freeze(false);
      await this.uppercut(att, vic, 10);
    } else {
      this.knockdown(vic, DAMAGE.special, att.dir);
      Sound.play('specialHit');
    }
    await Clock.until(() => vic.anim !== 'fall' && vic.anim !== 'hit');
    if (att.anim === 'sp_throw') att.play('stance');
    await Promise.all([att.walkTo(att.home), vic.walkTo(vic.home)]);
  }

  async uppercut(att, vic, damage) {
    att.play('uppercut', { next: null });
    Sound.play(att.female ? 'femaleAttack' : 'maleAttack');
    const peak = Math.floor(att.frames.length * 0.6);
    await Clock.until(() => att.index >= peak);
    this.knockdown(vic, damage, att.dir);
    Sound.play('uppercutHit');
    await Clock.until(() => att.done);
    att.play('stance');
  }

  knockdown(vic, damage, dir) {
    const c = vic.chest();
    vic.hurt(damage, 0);
    vic.play('fall', { next: vic.health > 0 ? 'stance' : 'dizzy' });
    this.fx.blood(c.x, c.y - 10, dir, 18);
    Sound.play(vic.female ? 'femaleHurt' : 'maleHurt');
    Sound.play('fallThud', 0.8);
    this.shake = 0.35;
  }

  toasty() {
    Sound.play('toasty');
    this.toastyT = 1.2;
  }

  async finishHim(winner, loser) {
    this.finishing = true;
    this.winner = winner;
    this.loser = loser;
    await Clock.until(() => loser.anim !== 'fall' && loser.anim !== 'hit');
    await Promise.all([winner.walkTo(winner.home), loser.walkTo(loser.home)]);
    loser.play('dizzy');
    this.hideWindow = true;
    this.banner({ prop: loser.female ? '0313' : '0312' }, 1.8);
    Sound.play(loser.female ? 'finishHer' : 'finishHim');
    Sound.music('finishMusic', 0.5);
    await Clock.wait(1.8);
    this.turn = winner.side;
    this.missesLeft = FATALITY_MISSES;
    this.solvedFlash = 0;
    this.hideWindow = false;
    this.setNote(`${winner.def.name}: SOLVE THIS WORD FOR THE FATALITY`, 2.5);
    this.newWord();
    this.awaitTurn();
  }

  async fatalityGuess(letter, result) {
    if (result === 'hit') {
      Sound.play('reveal');
      if (this.round.solved) {
        this.solvedFlash = 1;
        await this.fatality();
        return;
      }
    } else {
      this.missesLeft--;
      Sound.play('miss');
      this.setNote(this.missesLeft ? `NO "${letter}" - ${this.missesLeft} ${this.missesLeft === 1 ? 'MISS' : 'MISSES'} LEFT` : 'TOO SLOW!', 1.6);
      if (!this.missesLeft) {
        await Clock.wait(0.9);
        await this.plainWin();
        return;
      }
    }
    await Clock.wait(0.3);
    this.awaitTurn();
  }

  async fatality() {
    const { winner, loser } = this;
    await Clock.wait(0.9);
    this.hideWindow = true;
    Sound.stopMusic();
    this.dimTarget = 0.6;
    Sound.music('fatalityMusic', 0.55);
    const gap = loser.stanceW + winner.stanceW - 12;
    await winner.walkTo(loser.x - winner.dir * gap, 90);
    winner.play('fatality', { next: null });
    if (winner.slug === 'raiden') Sound.play('raidenSpecial');
    await Clock.until(() => winner.done);
    const fx = winner.def.anims.fatality_fx;
    if (fx) {
      const c = loser.chest();
      if (winner.def.special.freeze) loser.freeze(true);
      this.fx.anim(winner.image, fx, c.x, c.y, 12, winner.dir < 0);
      Sound.play(winner.def.special.freeze ? 'freeze' : 'projectile');
      await Clock.wait(fx.length / 12 + 0.2);
    }
    loser.visible = false;
    this.fx.explode(loser);
    Sound.play('explode');
    Sound.play(loser.female ? 'femaleScream' : 'maleScream');
    Sound.play('gore');
    this.shake = 0.6;
    await Clock.wait(1.6);
    this.banner({ fatality: true }, 3.2);
    Sound.play('fatality');
    await Clock.wait(2.4);
    winner.play('stance');
    await this.victory(true);
  }

  async plainWin() {
    const { loser } = this;
    const lying = Math.max(0, Math.floor(loser.def.anims.fall.length * 0.55));
    loser.play('fall', { stopAt: lying, next: null });
    Sound.play(loser.female ? 'femaleHurt' : 'maleHurt');
    Sound.play('fallThud');
    this.hideWindow = true;
    await Clock.wait(1.2);
    await this.victory(false);
  }

  async victory(fatal) {
    const { winner } = this;
    Sound.stopMusic();
    this.dimTarget = 0;
    winner.play('victory', { next: null });
    this.banner({ wins: winner }, 999);
    await Sound.say([`name_${winner.slug}`, 'wins']);
    if (winner.health >= 100) {
      this.banner({ text: 'FLAWLESS VICTORY', y: 104 }, 999);
      Sound.play('flawless');
    }
    this.result = fatal ? 'FATALITY' : 'NO FATALITY';
    await Clock.wait(1.2);
    this.state = 'over';
    Keyboard.show(false);
  }

  banner(b, seconds) {
    this.banners = this.banners.filter(x => !(b.prop || b.fatality) || !(x.prop || x.fatality));
    this.banners.push({ ...b, t: 0, life: seconds });
  }

  setNote(str, seconds) {
    this.note = { str, life: seconds };
  }

  update(dt) {
    this.arena.update(dt);
    for (const f of this.fighters) f.update(dt);
    this.fx.update(dt);
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter(b => b.t < b.life);
    if (this.note && (this.note.life -= dt) <= 0) this.note = null;
    this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 3);
    this.shake = Math.max(0, this.shake - dt);
    if (this.toastyT) this.toastyT = Math.max(0, this.toastyT - dt);
  }

  draw(ctx) {
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 4 * this.shake * 4, (Math.random() - 0.5) * 3 * this.shake * 4);
    this.arena.draw(ctx);
    if (this.dim > 0.01) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this.dim})`;
      ctx.fillRect(-10, -10, W + 20, H + 20);
    }
    const top = this.fighters[this.turn];
    for (const f of [this.fighters[1 - this.turn], top]) f.draw(ctx);
    this.fx.draw(ctx);
    ctx.restore();
    this.drawHud(ctx);
    this.drawWindow(ctx);
    this.drawBanners(ctx);
    if (this.toastyT > 0) this.drawToasty(ctx);
  }

  drawHud(ctx) {
    const [a, b] = this.fighters;
    healthBar(ctx, a, 12, 9, 162, false);
    healthBar(ctx, b, W - 12 - 162, 9, 162, true);
    const blink = Math.floor(Clock.now * 3) % 2 === 0;
    for (const f of this.fighters) {
      const active = this.state === 'input' && this.turn === f.side;
      const label = this.player(f.side) + (active && blink ? '  - TURN' : '');
      text(ctx, label, f.side === 0 ? 13 : W - 13, 28, { size: 6, align: f.side === 0 ? 'left' : 'right',
        color: active ? '#ffe36a' : '#aaa' });
    }
  }

  drawWindow(ctx) {
    if (!this.round || this.hideWindow) return;
    const x = 70;
    const y = 30;
    const w = W - 140;
    const h = 68;
    panel(ctx, x, y, w, h);
    const header = this.finishing ? `FATALITY WORD - ${this.missesLeft} ${this.missesLeft === 1 ? 'MISS' : 'MISSES'} LEFT` : 'DEFINITION';
    text(ctx, header, W / 2, y + 7, { size: 5.5, align: 'center', color: this.finishing ? '#ff5050' : '#d9a640' });
    // Definition, shrinking the type until it fits in three lines.
    let size = 7;
    let lines = wrap(ctx, this.round.definition, w - 12, size);
    while (lines.length > 3 && size > 5) lines = wrap(ctx, this.round.definition, w - 12, (size -= 0.5));
    lines.forEach((l, i) => text(ctx, l, W / 2, y + 15 + i * (size + 1), { size, align: 'center', color: '#f2f2f2' }));
    // The word: letters found so far over underscores.
    const word = this.round.word;
    const slot = Math.min(13, (w - 16) / word.length);
    const startX = W / 2 - (slot * word.length) / 2;
    const base = y + 45;
    const pattern = this.round.pattern();
    const glow = this.solvedFlash && Math.floor(Clock.now * 8) % 2 === 0;
    for (let i = 0; i < word.length; i++) {
      const cx = startX + slot * i + slot / 2;
      ctx.fillStyle = '#d9a640';
      ctx.fillRect(cx - slot * 0.36, base + 1.5, slot * 0.72, 1);
      if (pattern[i]) text(ctx, pattern[i], cx, base, { size: Math.min(12, slot * 0.95), align: 'center', color: glow ? '#ffffff' : 'gold' });
    }
    // Letters guessed so far: found in gold, misses in red.
    const used = [...this.round.guessed];
    const lead = used.length ? 'GUESSED: ' : 'GUESSED: NONE YET';
    let gx = W / 2 - textWidth(ctx, lead + used.join(' '), 6) / 2;
    text(ctx, lead, gx, y + 55, { size: 6, color: '#999' });
    gx += textWidth(ctx, lead, 6);
    for (const c of used) {
      text(ctx, c, gx, y + 55, { size: 6, color: word.includes(c) ? '#f4c542' : '#ff3030' });
      gx += textWidth(ctx, c + ' ', 6);
    }
    // Whose turn it is, or what just happened.
    const msg = this.note ? this.note.str : this.prompt();
    if (msg) text(ctx, msg, W / 2, y + 64.5, { size: 6, align: 'center', color: this.note ? '#ffe36a' : '#fff' });
  }

  prompt() {
    if (this.state !== 'input') return '';
    const f = this.fighters[this.turn];
    if (this.cpu[this.turn]) return `${f.def.name} (CPU) IS THINKING...`;
    const who = this.cpu[1 - this.turn] ? '' : `${this.player(this.turn)}: `;
    return `${who}${f.def.name}, PICK A LETTER`;
  }

  drawBanners(ctx) {
    const sheet = Images[ASSETS.props.image];
    for (const b of this.banners) {
      if (b.prop) {
        const pop = Math.min(1, b.t * 6);
        drawProp(ctx, 'text', b.prop, W / 2, 150, 0.6 + 0.4 * pop);
      } else if (b.fatality) {
        const ids = Object.keys(ASSETS.props.items.text).filter(id => id >= '0108' && id <= '0120');
        const id = ids[Math.min(ids.length - 1, Math.floor(b.t * 10))];
        drawProp(ctx, 'text', id, W / 2, 140);
      } else if (b.wins) {
        const label = prop('text', b.wins.def.label);
        const wins = prop('text', '0055');
        const s = 2;
        const total = (label[2] + 6 + wins[2]) * s;
        const left = W / 2 - total / 2;
        blit(ctx, sheet, label, left, 46, false, s);
        blit(ctx, sheet, wins, left + (label[2] + 6) * s, 46 + (label[3] - wins[3]) * s, false, s);
        if (this.state === 'over') {
          text(ctx, this.result, W / 2, 84, { size: 9, align: 'center', color: this.result === 'FATALITY' ? '#ff3030' : '#bbb' });
          if (Math.floor(Clock.now * 2) % 2 === 0) text(ctx, 'PRESS ENTER TO FIGHT AGAIN', W / 2, 250, { size: 8, align: 'center', color: 'gold' });
        }
      } else if (b.text) {
        text(ctx, b.text, W / 2, b.y || 130, { size: 14, align: 'center', color: 'gold', font: 'MKTitle' });
      }
    }
  }

  drawToasty(ctx) {
    const r = prop('hud', '0816');
    if (!r) return;
    const slide = Math.min(1, (1.2 - this.toastyT) * 8, this.toastyT * 8);
    blit(ctx, Images[ASSETS.props.image], r, W - r[2] * slide, H - r[3], false);
    text(ctx, 'TOASTY!', W - r[2] * slide + r[2] / 2, H - r[3] - 3, { size: 8, align: 'center', color: '#ff9030' });
  }
}

// A projectile special: the fighter's own MK2 projectile frames, flying straight at the opponent.
function projectile(att, hand) {
  const frames = att.def.anims.sp_proj;
  return {
    x: hand.x, y: hand.y, vx: att.dir * 300, t: 0,
    tip() {
      return this.x + att.dir * frames[0][2] * 0.4;
    },
    draw(ctx) {
      const r = frames[Math.floor(this.t * 14) % frames.length];
      blit(ctx, att.image, r, this.x - r[2] / 2, this.y - r[3] / 2, att.dir < 0);
    },
  };
}

// Scorpion's spear: the rope pays out from his hand, drawn from the spear tip backwards.
function spearShot(att, hand) {
  const r = att.def.anims.sp_proj[0];
  return {
    x: hand.x, y: hand.y, len: 10, vx: 0, t: 0,
    tip() {
      return hand.x + att.dir * (20 + this.t * 520);
    },
    draw(ctx) {
      this.len = Math.min(r[2], 20 + this.t * 520);
      const L = Math.round(this.len);
      const src = [r[0] + r[2] - L, r[1], L, r[3]];
      const left = att.dir > 0 ? hand.x : hand.x - L;
      blit(ctx, att.image, src, left, hand.y - r[3] / 2, att.dir < 0);
    },
  };
}
