// The word game: one shared word, letters guessed one at a time, and the CPU's guesser.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Scrabble tile values. A right letter's value picks the attack: rarer letters hit harder.
const SCRABBLE = {
  A: 1, E: 1, I: 1, L: 1, N: 1, O: 1, R: 1, S: 1, T: 1, U: 1, D: 2, G: 2, B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4, K: 5, J: 8, X: 8, Q: 10, Z: 10,
};
const ATTACK_NAMES = { punch: 'PUNCH', kick: 'KICK', roundhouse: 'ROUNDHOUSE', uppercut: 'UPPERCUT', special: 'SPECIAL MOVE' };

// Damage is 4 + 2 per point, plus 2 for each extra time the letter appears in the word. finisher is
// the special move's damage when this letter completes the word.
function attackFor(letter, count) {
  const value = SCRABBLE[letter];
  const kind = value >= 8 ? 'special' : value >= 4 ? 'uppercut' : value === 3 ? 'roundhouse' : value === 2 ? 'kick' : 'punch';
  const extra = 2 * (count - 1);
  return { kind, value, damage: 4 + 2 * value + extra, finisher: 16 + 2 * value + extra };
}

class WordRound {
  constructor(entry) {
    this.word = entry[0];
    this.definition = entry[1];
    this.guessed = new Set();
  }

  // 'repeat' for a letter already tried, otherwise 'hit' or 'miss'.
  guess(letter) {
    if (this.guessed.has(letter)) return 'repeat';
    this.guessed.add(letter);
    return this.word.includes(letter) ? 'hit' : 'miss';
  }

  get solved() {
    return [...this.word].every(c => this.guessed.has(c));
  }

  get misses() {
    return [...this.guessed].filter(c => !this.word.includes(c));
  }

  // The word with unguessed letters as null.
  pattern() {
    return [...this.word].map(c => (this.guessed.has(c) ? c : null));
  }
}

// Deals words in a shuffled order so nothing repeats until the list runs out.
class WordDeck {
  constructor(words) {
    this.words = words;
    this.order = [];
  }

  next() {
    if (!this.order.length) this.order = shuffle(this.words.map((_, i) => i));
    return new WordRound(this.words[this.order.pop()]);
  }
}

// How often each letter turns up in long English words, the CPU's sense of a "likely" letter.
const LETTER_WEIGHT = {
  E: 11.2, I: 8.9, A: 8.0, R: 7.6, T: 7.4, N: 7.1, S: 6.9, O: 6.5, L: 5.4, C: 4.5, U: 3.6, D: 3.4, P: 3.1,
  M: 2.9, H: 2.5, G: 2.4, B: 2.0, Y: 1.7, F: 1.3, V: 1.1, K: 0.8, W: 0.8, Z: 0.3, X: 0.3, Q: 0.2, J: 0.2,
};

// The CPU plays like a person: early on it guesses common letters (with some scatter), and the
// more of the word is showing, the more often it "sees" the word and picks a letter that fits.
// Simulated over 400 words each: about 8.7 misses a word on EASY, 4 on NORMAL, 2 on HARD.
const CPU_LEVELS = {
  EASY: { base: 0.0, read: 0.5, scatter: 1.8 },
  NORMAL: { base: 0.2, read: 0.95, scatter: 1.1 },
  HARD: { base: 0.55, read: 1.0, scatter: 0.7 },
};

function cpuGuess(round, words, level) {
  const cfg = CPU_LEVELS[level];
  const open = [...ALPHABET].filter(c => !round.guessed.has(c));
  const shown = round.pattern().filter(Boolean).length / round.word.length;
  if (Math.random() < cfg.base + (1 - cfg.base) * cfg.read * shown ** 1.5) {
    const best = bestLetter(round, words, open);
    if (best) return best;
  }
  // Frequency-weighted pick; scatter flattens the weights so weaker players stray further.
  const weights = open.map(c => LETTER_WEIGHT[c] ** (1 / cfg.scatter));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < open.length; i++) if ((r -= weights[i]) <= 0) return open[i];
  return open[0];
}

function bestLetter(round, words, open) {
  const pattern = round.pattern();
  const misses = new Set(round.misses);
  const counts = {};
  for (const [w] of words) {
    if (w.length !== pattern.length || !fits(w, pattern, misses, round.guessed)) continue;
    for (const c of new Set(w)) if (!round.guessed.has(c)) counts[c] = (counts[c] || 0) + 1;
  }
  let best = null;
  for (const c of open) if (counts[c] && (!best || counts[c] > counts[best])) best = c;
  return best;
}

function fits(w, pattern, misses, guessed) {
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    if (pattern[i] ? pattern[i] !== c : guessed.has(c) || misses.has(c)) return false;
  }
  return true;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
