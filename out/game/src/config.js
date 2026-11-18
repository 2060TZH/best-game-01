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
export const ENEMIES = {
  drifter: { hp: 1, speed: 62, score: 50, radius: 15, color: '#ff4d8d', firstWave: 1 },
  dart: { hp: 1, speed: 150, score: 80, radius: 11, color: '#39d5ff', firstWave: 1 },
  spinner: { hp: 2, speed: 48, score: 120, radius: 17, color: '#ffb02e', firstWave: 2 },
  bulwark: { hp: 6, speed: 34, score: 250, radius: 26, color: '#b06bff', firstWave: 3 },
};

// How a wave is built: wave n fields 6 + 3n hunters, trickled in over time.
export const WAVES = {
  winWave: 10, // clearing this wave wins the game
  baseCount: 6,
  perWave: 3,
  spawnInterval: 0.85, // seconds between spawns, shrinking as waves rise
  spawnMinInterval: 0.32,
  intervalShrink: 0.05, // per wave
  eliteEvery: 5, // every 5th wave is an elite wave (more bulwarks, faster)
  clearBonus: 250, // points for clearing a wave, times the wave number
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
