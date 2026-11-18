// VOIDLIGHT's boot and loop: the state machine around the world (title,
// play, pause, game over, victory), the fixed-step loop, and the staged
// screenshot scenes behind ?shot=start|play|win|over.
import { FIELD } from './config.js';
import { createWorld, STEP, SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_WIN } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { unlockAudio, setMuted, isMuted, sfx } from './audio.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'voidlight-best';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed')) || 1;

const world = createWorld(seed);
const state = world.state;
const input = createInput(canvas);

// Best score survives across sessions on this machine.
try {
  const saved = Number(window.localStorage.getItem(BEST_KEY));
  if (Number.isFinite(saved) && saved > 0) state.best = saved;
} catch {
  // Storage unavailable (private mode, file URL): the game plays on.
}

function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(state.best));
  } catch {
    // Best score is a nicety, not a requirement.
  }
}

// Track menu-key edges: a key counts once per press, not once per frame.
const downBefore = new Set();
function pressed(code) {
  const down = input.isDown(code);
  const edge = down && !downBefore.has(code);
  if (down) downBefore.add(code);
  else downBefore.delete(code);
  return edge;
}

function toggleMute() {
  setMuted(!isMuted());
  state.muted = isMuted();
}

function restart() {
  unlockAudio();
  sfx.click();
  world.start();
}

function stepMenus() {
  if (pressed('KeyM')) toggleMute();
  if (state.screen === SCREEN_TITLE) {
    if (pressed('Enter') || input.clicked) {
      restart();
    }
  } else if (state.screen === SCREEN_PLAY) {
    if (pressed('KeyP') || pressed('Escape')) {
      state.paused = !state.paused;
      sfx.click();
    }
    if (state.paused && input.clicked) state.paused = false;
  } else if (state.screen === SCREEN_OVER || state.screen === SCREEN_WIN) {
    saveBest();
    if (pressed('KeyR') || pressed('Enter') || input.clicked) restart();
  }
  input.clicked = false;
  input.pressedDash = false;
}

let last = performance.now();
let accumulator = 0;
let time = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  // A staged screenshot holds its moment: the world does not advance, so
  // the captured frame is exactly the scene the autopilot staged — the
  // bullets stay in flight, the combo stays lit, the wave stays busy.
  // Only the render-time animation (stars, spinner spin) keeps moving.
  if (!shotName) {
    stepMenus();
    if (state.screen === SCREEN_PLAY && !state.paused) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        world.step(STEP, input);
        accumulator -= STEP;
      }
    } else if (state.screen === SCREEN_TITLE) {
      // The title drifts on its own: one step per frame is enough.
      world.step(STEP, input);
    } else {
      world.step(STEP, input);
    }
  }
  time += elapsed;
  render(ctx, state, time);
}

// Staged screenshots: run the scene once, then keep rendering it (particles
// and banners keep animating) so the capture catches a living frame.
if (shotName) {
  stageShot(shotName, world);
  saveBest();
  requestAnimationFrame(frame);
  window.__voidlightReady = true;
} else {
  requestAnimationFrame(frame);
}

// For play-testing from the console: window.__voidlight.state.
window.__voidlight = { world, state, input };
