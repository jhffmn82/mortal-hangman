// Plays the MK2 sounds by name; js/sfx.js maps each name to one or more clips in assets/sounds.

const Sound = {
  muted: false,
  pools: {},
  musicEl: null,

  src(clip) {
    return `assets/sounds/${clip}.mp3`;
  },

  preload() {
    for (const clips of Object.values(SFX)) for (const c of clips) this.element(c);
  },

  element(clip) {
    const pool = this.pools[clip] || (this.pools[clip] = []);
    let a = pool.find(x => x.paused || x.ended);
    if (!a) {
      a = new Audio(this.src(clip));
      a.preload = 'auto';
      pool.push(a);
    }
    return a;
  },

  pickClip(name) {
    const clips = SFX[name];
    return clips && clips.length ? clips[Math.floor(Math.random() * clips.length)] : null;
  },

  // Fire and forget; returns the element so a caller can wait for it to end.
  play(name, volume = 1) {
    const clip = this.pickClip(name);
    if (!clip || this.muted) return null;
    const a = this.element(clip);
    a.volume = volume;
    a.currentTime = 0;
    a.play().catch(() => {});
    return a;
  },

  // Plays names one after another, as Shao Kahn does with "LIU KANG ... WINS".
  async say(names) {
    for (const n of names) {
      const a = this.play(n);
      if (!a) continue;
      await new Promise(resolve => {
        a.onended = resolve;
        setTimeout(resolve, 2500);
      });
    }
  },

  music(name, volume = 0.6) {
    this.stopMusic();
    this.musicEl = this.play(name, volume);
  },

  stopMusic() {
    if (this.musicEl) this.musicEl.pause();
    this.musicEl = null;
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopMusic();
  },
};
