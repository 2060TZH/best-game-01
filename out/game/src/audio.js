// Sound, synthesised with WebAudio: no audio files, no network, nothing to
// load. Every effect is a short oscillator or noise burst with an envelope.
// The first user gesture creates the context (browsers require it); until
// then every call is a silent no-op.
let context = null;
let muted = false;
let noiseBuffer = null;

function ensureContext() {
  if (context !== null) return context;
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return null;
  context = new AudioContext();
  const length = Math.floor(context.sampleRate * 0.3);
  noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return context;
}

export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

// One oscillator blip: frequency slides from `from` to `to` over `seconds`.
function blip(from, to, seconds, type, volume) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + seconds + 0.02);
}

// One burst of filtered noise, for impacts and explosions.
function noise(seconds, volume, cutoff) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx || !noiseBuffer) return;
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, cutoff / 6), now + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now + seconds + 0.02);
}

// A short arpeggio of blips, for pickups and fanfares.
function arpeggio(notes, step, type, volume) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  notes.forEach((frequency, index) => {
    const at = ctx.currentTime + index * step;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + step * 1.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + step * 1.8 + 0.02);
  });
}

export const sfx = {
  shoot() {
    blip(740, 320, 0.07, 'square', 0.05);
  },
  hit() {
    noise(0.09, 0.16, 2400);
  },
  kill() {
    noise(0.22, 0.22, 1500);
    blip(220, 55, 0.18, 'sawtooth', 0.1);
  },
  playerHit() {
    noise(0.3, 0.3, 900);
    blip(180, 40, 0.35, 'sawtooth', 0.16);
  },
  pickup() {
    arpeggio([523, 659, 784], 0.06, 'sine', 0.12);
  },
  powerup() {
    arpeggio([392, 523, 659, 784], 0.07, 'triangle', 0.12);
  },
  wave() {
    arpeggio([262, 392], 0.12, 'triangle', 0.14);
    blip(196, 392, 0.3, 'sine', 0.08);
  },
  bomb() {
    noise(0.6, 0.32, 700);
    blip(120, 30, 0.5, 'sawtooth', 0.14);
  },
  victory() {
    arpeggio([523, 659, 784, 1047, 1319], 0.11, 'triangle', 0.14);
  },
  defeat() {
    arpeggio([392, 330, 262, 196], 0.16, 'sawtooth', 0.1);
  },
  dash() {
    noise(0.12, 0.1, 3200);
  },
  click() {
    blip(880, 660, 0.05, 'sine', 0.07);
  },
};
