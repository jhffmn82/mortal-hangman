// Boot, the main loop, scaling the 400x254 screen to the window, keyboard and on-screen letter keys.

const canvas = document.getElementById('screen');
const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1; // ?speed=4 for testing
const ctx = canvas.getContext('2d');

// The clickable letters under the screen, for mouse and touch players.
const Keyboard = {
  el: document.getElementById('keys'),
  buttons: {},
  build() {
    for (const c of ALPHABET) {
      const b = document.createElement('button');
      b.textContent = c;
      b.addEventListener('click', () => Game.key(c));
      this.el.appendChild(b);
      this.buttons[c] = b;
    }
  },
  show(on) {
    this.el.classList.toggle('hidden', !on);
    Game.resize();
  },
  reset() {
    for (const b of Object.values(this.buttons)) {
      b.className = '';
      b.disabled = false;
    }
  },
  mark(c, right) {
    this.buttons[c].className = right ? 'right' : 'wrong';
    this.buttons[c].disabled = true;
  },
  enable(on) {
    for (const b of Object.values(this.buttons)) if (!b.className) b.disabled = !on;
  },
};

const Game = {
  scene: null,
  scale: 1,

  show(scene) {
    Clock.reset();
    this.scene = scene;
    if (scene.enter) scene.enter();
  },

  key(k) {
    if (k === '0') {
      Sound.toggleMute();
      return;
    }
    if (k === 'Escape' && !(this.scene instanceof Title) && !(this.scene instanceof Select)) {
      Sound.stopMusic();
      this.show(new Title(this.scene.opts));
      return;
    }
    if (this.scene && this.scene.onKey) this.scene.onKey(k);
  },

  resize() {
    const keysH = Keyboard.el.classList.contains('hidden') ? 0 : Keyboard.el.offsetHeight;
    const helpH = document.getElementById('help').offsetHeight;
    const availW = window.innerWidth;
    const availH = window.innerHeight - keysH - helpH - 4;
    const cssScale = Math.max(1, Math.min(availW / W, availH / H));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${Math.floor(W * cssScale)}px`;
    canvas.style.height = `${Math.floor(H * cssScale)}px`;
    canvas.width = Math.floor(W * cssScale * dpr);
    canvas.height = Math.floor(H * cssScale * dpr);
    this.scale = canvas.width / W;
  },

  frame(dt) {
    Clock.tick(dt);
    if (this.scene) this.scene.update(dt);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (this.scene) this.scene.draw(ctx);
  },
};

function imagePaths() {
  const paths = [ASSETS.props.image];
  for (const f of Object.values(ASSETS.fighters)) paths.push(f.image);
  for (const a of Object.values(ASSETS.arenas)) {
    paths.push(a.image);
    if (a.anim) paths.push(a.anim);
  }
  return paths;
}

async function boot() {
  Keyboard.build();
  Game.resize();
  window.addEventListener('resize', () => Game.resize());
  ctx.setTransform(Game.scale, 0, 0, Game.scale, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  await document.fonts.load('10px MK2');
  await document.fonts.load('10px MKTitle');
  text(ctx, 'LOADING...', W / 2, H / 2, { size: 12, align: 'center', color: 'gold' });
  await loadImages(imagePaths());
  Sound.preload();

  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let k = e.key;
    if (k.length === 1) k = k.toUpperCase();
    if (k.startsWith('Arrow') || k === ' ' || k === 'Enter') e.preventDefault();
    Game.key(k);
  });
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    if (Game.scene && Game.scene.onClick) Game.scene.onClick(x, y);
    else Game.key('Enter');
  });

  Game.show(new Title());
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000) * SPEED;
    last = now;
    requestAnimationFrame(loop);
    try {
      Game.frame(dt);
    } catch (err) {
      if (!loop.failed) console.error(err);
      loop.failed = true;
    }
  };
  requestAnimationFrame(loop);
}

boot().catch(err => {
  console.error(err);
  ctx.setTransform(Game.scale, 0, 0, Game.scale, 0, 0);
  text(ctx, 'FAILED TO LOAD: ' + err.message, 10, 20, { size: 7, color: '#f44' });
});
