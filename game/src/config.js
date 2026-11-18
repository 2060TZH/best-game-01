// VOIDLIGHT — arena wave shooter: every number the game tunes by lives here.
// The field is 960x640. The player is a small ship; waves of geometric hunters
// close in, the player answers with aimed fire, and clearing wave 10 wins.
export const FIELD = { width: 960, height: 640 };

// Player ship.
export const PLAYER = {
  radius: 14,
  speed: 330, // px per second
  fireInterval: 0.16, // seconds between shots
  lives: 3,
  hitInvulnerable: 1.6, // seconds of mercy after a hit
  dashCooldown: 2.2, // seconds
  dashTime: 0.14, // seconds of dash
  dashSpeed: 980, // px per second while dashing
};

// Player bullets.
export const BULLET = { speed: 640, radius: 4, damage: 1, life: 1.1 };

// Enemy kinds. Each has hit points, speed, score, radius, colour and the wave
// it first appears on. Bulwarks split into two drifters when they die.
// The boss only appears on boss waves (5 and 10); wave 10's boss is tougher.
export const ENEMIES = {
  drifter: { hp: 1, speed: 62, score: 50, radius: 15, color: '#ff4d8d', firstWave: 1 },
  dart: { hp: 1, speed: 150, score: 80, radius: 11, color: '#39d5ff', firstWave: 1 },
  spinner: { hp: 2, speed: 48, score: 120, radius: 17, color: '#ffb02e', firstWave: 2 },
  bulwark: { hp: 6, speed: 34, score: 250, radius: 26, color: '#b06bff', firstWave: 3 },
  boss: { hp: 120, speed: 42, score: 2000, radius: 46, color: '#ff2e88', firstWave: 5 },
};

// The boss's own attacks: a radial orb burst, a telegraphed charge, and a
// trickle of drifter minions while it lives. (Boss hit points live in
// ENEMIES.boss.hp and BOSS.finalHp.)
export const BOSS = {
  finalHp: 220, // wave 10's boss
  finalScore: 5000,
  burstCount: 12, // orbs in one radial burst
  burstInterval: 3.4, // seconds between bursts
  chargeTelegraph: 0.55, // seconds it warns before charging
  chargeSpeed: 520,
  minionInterval: 8, // seconds between minion spawns
  minionBatch: 2,
};

// Draft upgrades: after every cleared wave but the last, the player picks
// one of three. Each stacks to its max level; the draft never offers a
// maxed-out upgrade.
export const UPGRADES = {
  split: { name: 'SPLIT SHOT', desc: '+1 bullet per shot', max: 3, color: '#ffd94d', glyph: '✦' },
  rapid: { name: 'RAPID FIRE', desc: 'Fire 18% faster', max: 3, color: '#ff7a59', glyph: '»' },
  heavy: { name: 'HEAVY ROUNDS', desc: '+1 bullet damage', max: 3, color: '#ff4d8d', glyph: '◆' },
  repair: { name: 'REPAIR NANITES', desc: '+1 max life, heal 1 now', max: 2, color: '#5df2a6', glyph: '+' },
  swift: { name: 'SWIFT DASH', desc: 'Dash recharges 30% faster', max: 3, color: '#4de8ff', glyph: '➤' },
  magnet: { name: 'VOID MAGNET', desc: 'Power-ups fly to you', max: 1, color: '#b06bff', glyph: '◎' },
  adrenal: { name: 'ADRENAL CORE', desc: 'Combo lasts longer, caps at x12', max: 1, color: '#ffb02e', glyph: '×' },
  wake: { name: 'VOID WAKE', desc: 'Dashing damages enemies', max: 1, color: '#e8f0ff', glyph: '≋' },
};
export const UPGRADE_IDS = ['split', 'rapid', 'heavy', 'repair', 'swift', 'magnet', 'adrenal', 'wake'];

// How a wave is built: wave n fields 6 + 3n hunters, trickled in over time.
// Waves 5 and 10 are boss waves: one boss plus a trickle of minions.
export const WAVES = {
  winWave: 10, // clearing this wave wins the game
  baseCount: 6,
  perWave: 4,
  spawnInterval: 0.85, // seconds between spawns, shrinking as waves rise
  spawnMinInterval: 0.25,
  intervalShrink: 0.07, // per wave
  eliteEvery: 5, // every 5th wave is an elite wave (more bulwarks, faster)
  clearBonus: 250, // points for clearing a wave, times the wave number
  bossWaves: [5, 10],
  bossMinions: 12, // minions trickling in beside the wave-5 boss
  finalMinions: 18, // minions beside the wave-10 boss
};

// Power-ups: what drops, how often, how long it lasts.
export const POWERUPS = {
  spread: { color: '#ffd94d', drop: 0.09, duration: 12 }, // triple shot
  shield: { color: '#5df2a6', drop: 0.07, duration: 0 }, // absorbs one hit
  overdrive: { color: '#ff7a59', drop: 0.07, duration: 8 }, // fire rate x2
  heart: { color: '#ff5d7a', drop: 0.03, duration: 0 }, // +1 life, capped
  bomb: { color: '#e8f4ff', drop: 0.04, duration: 0 }, // clears the field
  fallSpeed: 70,
  radius: 13,
  life: 9, // seconds before a dropped power-up fades
};

// Combo: kills chained inside the window raise the multiplier, up to x8.
export const COMBO = { window: 2.5, max: 8 };

// Spinner orbs: slow shots the spinner fires at the player.
export const ORB = { speed: 130, radius: 6, damage: 1 };

// The look: one dark field, one neon palette, so the scene reads at a glance.
export const PALETTE = {
  background: '#070a1a',
  grid: 'rgba(90, 120, 255, 0.10)',
  star: 'rgba(220, 235, 255, 0.55)',
  player: '#4de8ff',
  playerCore: '#eafcff',
  bullet: '#bff6ff',
  text: '#e8f0ff',
  dimText: '#8fa3d9',
  gold: '#ffd94d',
  danger: '#ff5d7a',
  panel: 'rgba(10, 16, 42, 0.82)',
  panelEdge: 'rgba(120, 160, 255, 0.35)',
};

// Timing and feel.
export const FEEL = {
  shakeOnHit: 9, // px of screen shake when the player is hit
  shakeOnKill: 3, // px when a bulwark dies
  hitStop: 0.045, // seconds the world freezes on a bulwark kill
  popupRise: 34, // px a score popup floats
  popupLife: 0.9, // seconds a score popup lives
};
