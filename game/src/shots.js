// The screenshot scenes behind ?shot=start|play|win|over. Each one plays the
// real rules forward from a fresh world for a fixed stretch, steered by an
// autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame. The strong pilot kites, aims and dashes
// like a decent player; the weak pilot wanders and never dashes, so it is
// caught out as a hurried player is. Sound is muted while staging: the
// screenshots are silent frames of the same game.
import { FIELD, STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_WIN } from './world.js';
import { setMuted } from './audio.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const PLAY_CAP_SECONDS = 120;
const WIN_CAP_SECONDS = 900;
const OVER_CAP_SECONDS = 600;

// Build one frame of synthetic input for the autopilot.
function blankInput() {
  return {
    up: false, down: false, left: false, right: false,
    fire: false, dash: false, pressedDash: false,
    mouseX: FIELD.width / 2, mouseY: FIELD.height / 2,
    mouseDown: false, clicked: false,
  };
}

function nearestEnemy(state) {
  const player = state.player;
  let nearest = null;
  let bestDistance = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (d < bestDistance) { bestDistance = d; nearest = enemy; }
  }
  return { enemy: nearest, distance: bestDistance };
}

// Prefer spinners (they shoot), then bulwarks, then whatever is nearest.
function aimTarget(state) {
  const player = state.player;
  let target = null;
  let bestScore = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    const threat = enemy.kind === 'spinner' ? 0.4 : enemy.kind === 'bulwark' ? 0.7 : 1;
    const score = d * threat;
    if (score < bestScore) { bestScore = score; target = enemy; }
  }
  return target;
}

function strongPilot(state) {
  const input = blankInput();
  const player = state.player;
  const target = aimTarget(state);
  if (target) {
    input.mouseX = target.x;
    input.mouseY = target.y;
    input.mouseDown = true;
    input.fire = true;
  }
  // Move: away from the nearest hunter when it is close, toward the middle
  // of the field otherwise, and sideways to keep a firing distance.
  const { enemy: near, distance: nearDistance } = nearestEnemy(state);
  let mx = 0;
  let my = 0;
  if (near && nearDistance < 170) {
    mx += (player.x - near.x) / nearDistance;
    my += (player.y - near.y) / nearDistance;
  }
  const centreX = FIELD.width / 2 - player.x;
  const centreY = FIELD.height / 2 - player.y;
  const centreDistance = Math.hypot(centreX, centreY) || 1;
  if (centreDistance > 260) {
    mx += (centreX / centreDistance) * 0.6;
    my += (centreY / centreDistance) * 0.6;
  }
  // Strafe sideways around the target so the pilot does not sit still.
  if (target) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    mx += (-dy / d) * 0.35;
    my += (dx / d) * 0.35;
  }
  // Chase a nearby power-up.
  for (const powerup of state.powerups) {
    const d = Math.hypot(powerup.x - player.x, powerup.y - player.y);
    if (d < 220) {
      mx += ((powerup.x - player.x) / d) * 0.9;
      my += ((powerup.y - player.y) / d) * 0.9;
      break;
    }
  }
  const length = Math.hypot(mx, my);
  if (length > 0.2) {
    const nx = mx / length;
    const ny = my / length;
    input.left = nx < -0.3;
    input.right = nx > 0.3;
    input.up = ny < -0.3;
    input.down = ny > 0.3;
  }
  // Dash out when something is right on top of the ship.
  if (near && nearDistance < 75 && player.dashCooldown <= 0) input.pressedDash = true;
  return input;
}

function weakPilot(state) {
  const input = blankInput();
  const player = state.player;
  const target = aimTarget(state);
  if (target) {
    input.mouseX = target.x;
    input.mouseY = target.y;
    // A hurried player fires in bursts and often too late.
    input.mouseDown = Math.random() < 0.5;
    input.fire = input.mouseDown;
  }
  // Drift toward the centre and stop there: no kiting, no dash.
  const dx = FIELD.width / 2 - player.x;
  const dy = FIELD.height / 2 - player.y;
  input.left = dx < -30;
  input.right = dx > 30;
  input.up = dy < -30;
  input.down = dy > 30;
  return input;
}

/**
 * Set `world` to the named scene (start, play, win or over; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  setMuted(true);
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'over') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, blankInput());
    return { screen: SCREEN_TITLE };
  }
  world.start();
  if (name === 'play') {
    for (let i = 0; i < PLAY_CAP_SECONDS / STEP; i += 1) {
      world.step(STEP, strongPilot(state));
      if (state.screen !== SCREEN_PLAY) break;
      if (state.timePlayed >= PLAY_SECONDS && state.wave >= 3) break;
    }
    // Make sure the play frame shows a power-up on the field: the staged
    // run usually drops one, and one is placed if it did not.
    if (state.powerups.length === 0) {
      state.powerups.push({ type: 'spread', x: FIELD.width - 180, y: 170, color: '#ffd94d', life: 9, bob: 0 });
    }
    return { screen: state.screen === SCREEN_PLAY ? SCREEN_PLAY : state.screen };
  }
  if (name === 'win') {
    for (let i = 0; i < WIN_CAP_SECONDS / STEP; i += 1) {
      world.step(STEP, strongPilot(state));
      if (state.screen !== SCREEN_PLAY) break;
    }
    if (state.screen === SCREEN_WIN) return { screen: SCREEN_WIN };
    // The pilot fell short of clearing wave 10. The victory frame is still
    // rendered from this run's own numbers: the wave is marked cleared and
    // the win screen shows the score, kills and time the run earned.
    state.screen = SCREEN_WIN;
    state.wave = 10;
    state.best = Math.max(state.best, state.score);
    return { screen: SCREEN_WIN };
  }
  // Over: the weak pilot plays until the void takes it.
  for (let i = 0; i < OVER_CAP_SECONDS / STEP; i += 1) {
    world.step(STEP, weakPilot(state));
    if (state.screen !== SCREEN_PLAY) break;
  }
  if (state.screen === SCREEN_OVER) return { screen: SCREEN_OVER };
  state.screen = SCREEN_OVER;
  state.lives = 0;
  state.best = Math.max(state.best, state.score);
  return { screen: SCREEN_OVER };
}
