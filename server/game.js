const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MIN = 1;
const MAX = 90;

/**
 * The balls drawn so far, in order. Saved to a JSON file so a restart keeps the game.
 *
 * Draws use crypto.randomInt, which reads the operating system's cryptographically
 * secure random number generator (seeded from hardware entropy) and uses rejection
 * sampling, so every remaining ball has exactly the same chance of being drawn.
 * The 3D physics in the browser is for show and play only: it never decides the ball.
 */
class Game {
  constructor(file) {
    this.file = file;
    this.drawn = [];
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (Array.isArray(data.drawn)) {
        this.drawn = [...new Set(data.drawn.filter((n) => Number.isInteger(n) && n >= MIN && n <= MAX))];
      }
    } catch {
      this.drawn = [];
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ drawn: this.drawn }, null, 2));
  }

  remaining() {
    const drawn = new Set(this.drawn);
    const pool = [];
    for (let n = MIN; n <= MAX; n++) if (!drawn.has(n)) pool.push(n);
    return pool;
  }

  state() {
    return {
      min: MIN,
      max: MAX,
      drawn: [...this.drawn],
      last: this.drawn.length ? this.drawn[this.drawn.length - 1] : null,
      remaining: MAX - MIN + 1 - this.drawn.length,
      randomSource: "crypto.randomInt (operating system CSPRNG)",
    };
  }

  /** Draw one ball uniformly at random from those still in the cage. Returns null when empty. */
  draw() {
    const pool = this.remaining();
    if (!pool.length) return null;
    const n = pool[crypto.randomInt(pool.length)];
    this.drawn.push(n);
    this.save();
    return n;
  }

  reset() {
    this.drawn = [];
    this.save();
  }
}

module.exports = { Game };
