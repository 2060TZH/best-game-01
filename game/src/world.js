// VOIDLIGHT's world: the whole game state and how it changes. One step is
// 1/60s of play. The world knows nothing about the canvas; render.js draws
// whatever this state holds. A seeded random source makes a staged run
// repeatable, which is how the screenshots are taken.
import { FIELD, PLAYER, BULLET, ENEMIES, WAVES, POWERUPS, COMBO, ORB, FEEL, BOSS, UPGRADES, UPGRADE_IDS } from './config.js';
import { makeRandom, intBetween, pick } from './random.js';
import { sfx } from './audio.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_DRAFT = 'draft';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const STEP = 1 / 60;

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function freshPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invulnerable: 0,
    shield: false,
    spreadTimer: 0,
    overdriveTimer: 0,
  };
}

function freshState() {
  return {
    screen: SCREEN_TITLE,
    score: 0,
    best: 0,
    lives: PLAYER.lives,
    maxLives: PLAYER.lives,
    wave: 0,
    combo: 0,
    comboTimer: 0,
    comboMax: COMBO.max,
    upgrades: {},
    draft: [],
    draftRects: [],
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    timePlayed: 0,
    player: freshPlayer(),
    bullets: [],
    enemies: [],
    orbs: [],
    particles: [],
    popups: [],
    // 3D-rendered attack effects (explosion frames, shockwave rings):
    // age in seconds, removed when they outlive their duration.
    fx: [],
    powerups: [],
    spawnQueue: [],
    spawnTimer: 0,
    waveState: 'idle',
    clearTimer: 0,
    banner: '',
    bannerTimer: 0,
    shake: 0,
    hitStop: 0,
    flashRed: 0,
    muted: false,
    paused: false,
  };
}

// Which kinds may appear on a wave, and how many of each.
function buildWaveQueue(random, wave) {
  // Boss waves: the boss leads, then a trickle of minions.
  if (WAVES.bossWaves.includes(wave)) {
    const queue = ['boss'];
    const minions = wave === WAVES.winWave ? WAVES.finalMinions : WAVES.bossMinions;
    const kinds = ['drifter', 'dart'];
    if (wave >= 2) kinds.push('spinner');
    if (wave >= 3) kinds.push('bulwark');
    for (let i = 0; i < minions; i += 1) queue.push(pick(random, kinds));
    return queue;
  }
  const total = WAVES.baseCount + WAVES.perWave * wave;
  const kinds = ['drifter', 'dart'];
  if (wave >= 2) kinds.push('spinner');
  if (wave >= 3) kinds.push('bulwark');
  const queue = [];
  for (let i = 0; i < total; i += 1) {
    let kind = pick(random, kinds);
    // Elite waves (every 5th) are heavy on bulwarks.
    if (wave % WAVES.eliteEvery === 0 && random() < 0.4) kind = 'bulwark';
    if (wave >= 3 && random() < 0.12) kind = 'bulwark';
    queue.push(kind);
  }
  // Shuffle the queue so the mix is not grouped by kind.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

function spawnPoint(random, state) {
  for (let tries = 0; tries < 12; tries += 1) {
    const edge = intBetween(random, 0, 3);
    const margin = 30;
    let x = 0;
    let y = 0;
    if (edge === 0) { x = margin + random() * (FIELD.width - margin * 2); y = margin; }
    if (edge === 1) { x = margin + random() * (FIELD.width - margin * 2); y = FIELD.height - margin; }
    if (edge === 2) { x = margin; y = margin + random() * (FIELD.height - margin * 2); }
    if (edge === 3) { x = FIELD.width - margin; y = margin + random() * (FIELD.height - margin * 2); }
    if (distance(x, y, state.player.x, state.player.y) > 190) return { x, y };
  }
  return { x: 30, y: 30 };
}

function makeEnemy(random, state, kind) {
  const spec = ENEMIES[kind];
  const point = spawnPoint(random, state);
  const elite = state.wave % WAVES.eliteEvery === 0;
  const isFinalBoss = kind === 'boss' && state.wave === WAVES.winWave;
  return {
    kind,
    x: point.x,
    y: point.y,
    vx: 0,
    vy: 0,
    hp: isFinalBoss ? BOSS.finalHp : spec.hp + (elite && kind === 'bulwark' ? 2 : 0),
    maxHp: isFinalBoss ? BOSS.finalHp : spec.hp + (elite && kind === 'bulwark' ? 2 : 0),
    speed: spec.speed * (1 + (state.wave - 1) * 0.07) * (elite ? 1.15 : 1),
    radius: spec.radius,
    score: isFinalBoss ? BOSS.finalScore : spec.score,
    color: spec.color,
    angle: 0,
    // Dart state: 0 wandering, 1 telegraphing, 2 lunging, with a timer.
    // Boss state: 0 chasing, 1 telegraphing a charge, 2 charging.
    mode: 0,
    modeTimer: 1 + random() * 1.5,
    fireTimer: 1.5 + random() * 1.5,
    burstTimer: BOSS.burstInterval,
    minionTimer: BOSS.minionInterval,
    wakeHitten: false,
    flash: 0,
  };
}

export function createWorld(seed) {
  const random = makeRandom(seed);
  const state = freshState();

  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const velocity = speed * (0.3 + random() * 0.7);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0.4 + random() * 0.4,
        maxLife: 0.8,
        size: 1.5 + random() * 2.5,
        color,
      });
    }
  }

  function addPopup(x, y, text, color) {
    state.popups.push({ x, y, text, color, life: FEEL.popupLife, maxLife: FEEL.popupLife });
  }

  function addFx(x, y, kind, scale, duration) {
    state.fx.push({ x, y, kind, scale, age: 0, duration });
  }

  function dropPowerup(x, y) {
    const roll = random();
    let type = null;
    if (roll < POWERUPS.spread.drop) type = 'spread';
    else if (roll < POWERUPS.spread.drop + POWERUPS.shield.drop) type = 'shield';
    else if (roll < POWERUPS.spread.drop + POWERUPS.shield.drop + POWERUPS.overdrive.drop) type = 'overdrive';
    else if (roll < POWERUPS.spread.drop + POWERUPS.shield.drop + POWERUPS.overdrive.drop + POWERUPS.heart.drop) type = 'heart';
    else if (roll < POWERUPS.spread.drop + POWERUPS.shield.drop + POWERUPS.overdrive.drop + POWERUPS.heart.drop + POWERUPS.bomb.drop) type = 'bomb';
    if (!type) return;
    state.powerups.push({
      type,
      x: Math.max(20, Math.min(FIELD.width - 20, x)),
      y: Math.max(20, Math.min(FIELD.height - 20, y)),
      color: POWERUPS[type].color,
      life: POWERUPS.life,
      bob: random() * Math.PI * 2,
    });
  }

  function killEnemy(enemy, awardScore) {
    const index = state.enemies.indexOf(enemy);
    if (index === -1) return;
    state.enemies.splice(index, 1);
    state.kills += 1;
    addParticles(enemy.x, enemy.y, enemy.color, enemy.kind === 'bulwark' ? 26 : 12, 220);
    addFx(enemy.x, enemy.y, 'explosion', enemy.kind === 'boss' ? 2 : 1, enemy.kind === 'boss' ? 0.6 : 0.4);
    if (awardScore) {
      state.combo += 1;
      state.comboTimer = COMBO.window + ((state.upgrades.adrenal || 0) > 0 ? 1 : 0);
      const multiplier = Math.min(state.combo, state.comboMax);
      const points = enemy.score * multiplier;
      state.score += points;
      addPopup(enemy.x, enemy.y - 10, `+${points}${multiplier > 1 ? ` x${multiplier}` : ''}`, multiplier > 1 ? '#ffd94d' : '#e8f0ff');
    }
    if (enemy.kind === 'boss') {
      sfx.bomb();
      state.shake = 16;
      state.hitStop = 0.09;
      state.flashRed = 0.15;
      addParticles(enemy.x, enemy.y, enemy.color, 60, 320);
      addParticles(enemy.x, enemy.y, '#ffd94d', 30, 240);
      addPopup(enemy.x, enemy.y - 56, 'BOSS DOWN!', '#ffd94d');
    } else if (enemy.kind === 'bulwark') {
      sfx.kill();
      state.shake = Math.max(state.shake, FEEL.shakeOnKill);
      state.hitStop = FEEL.hitStop;
      // A bulwark splits into two drifters.
      for (let i = 0; i < 2; i += 1) {
        const child = makeEnemy(random, state, 'drifter');
        child.x = enemy.x + (i === 0 ? -24 : 24);
        child.y = enemy.y;
        state.enemies.push(child);
      }
    } else {
      sfx.kill();
    }
    dropPowerup(enemy.x, enemy.y);
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildWaveQueue(random, wave);
    state.spawnTimer = 0.6;
    state.waveState = 'spawning';
    state.banner = WAVES.bossWaves.includes(wave)
      ? (wave === WAVES.winWave ? 'FINAL BOSS' : `BOSS WAVE ${wave}`)
      : wave % WAVES.eliteEvery === 0 ? `ELITE WAVE ${wave}` : `WAVE ${wave}`;
    state.bannerTimer = 2.0;
    sfx.wave();
  }

  function clearWave() {
    const bonus = WAVES.clearBonus * state.wave;
    state.score += bonus;
    addPopup(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE BONUS +${bonus}`, '#ffd94d');
    if (state.wave >= WAVES.winWave) {
      state.screen = SCREEN_WIN;
      state.best = Math.max(state.best, state.score);
      sfx.victory();
      return;
    }
    // Every cleared wave but the last opens the draft: pick 1 of 3
    // upgrades, then the next wave starts.
    openDraft();
  }

  function openDraft() {
    const available = UPGRADE_IDS.filter((id) => (state.upgrades[id] || 0) < UPGRADES[id].max);
    const offers = [];
    while (offers.length < 3 && available.length > 0) {
      const index = Math.floor(random() * available.length);
      offers.push(available.splice(index, 1)[0]);
    }
    state.draft = offers;
    state.draftRects = [];
    state.waveState = 'draft';
    state.screen = SCREEN_DRAFT;
    state.banner = '';
    state.bannerTimer = 0;
    sfx.powerup();
  }

  function applyDraft(pick) {
    const id = state.draft[pick];
    if (!id) return;
    state.upgrades[id] = (state.upgrades[id] || 0) + 1;
    if (id === 'repair') {
      state.maxLives = Math.min(7, state.maxLives + 1);
      state.lives = Math.min(state.maxLives, state.lives + 1);
    }
    if (id === 'adrenal') {
      state.comboMax = COMBO.max + 4;
    }
    addPopup(FIELD.width / 2, FIELD.height / 2 - 40, `${UPGRADES[id].name}!`, UPGRADES[id].color);
    state.draft = [];
    state.screen = SCREEN_PLAY;
    startWave(state.wave + 1);
  }

  function hurtPlayer() {
    const player = state.player;
    if (player.invulnerable > 0 || player.dashTimer > 0) return;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 1.0;
      addPopup(player.x, player.y - 24, 'SHIELD!', '#5df2a6');
      sfx.hit();
      return;
    }
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    player.invulnerable = PLAYER.hitInvulnerable;
    state.shake = FEEL.shakeOnHit;
    state.flashRed = 0.35;
    addParticles(player.x, player.y, '#ff5d7a', 22, 260);
    sfx.playerHit();
    if (state.lives <= 0) {
      state.screen = SCREEN_OVER;
      state.best = Math.max(state.best, state.score);
      sfx.defeat();
    }
  }

  function applyPowerup(type) {
    const player = state.player;
    if (type === 'spread') {
      player.spreadTimer = POWERUPS.spread.duration;
      addPopup(player.x, player.y - 24, 'TRIPLE SHOT!', POWERUPS.spread.color);
    } else if (type === 'shield') {
      player.shield = true;
      addPopup(player.x, player.y - 24, 'SHIELD UP!', POWERUPS.shield.color);
    } else if (type === 'overdrive') {
      player.overdriveTimer = POWERUPS.overdrive.duration;
      addPopup(player.x, player.y - 24, 'OVERDRIVE!', POWERUPS.overdrive.color);
    } else if (type === 'heart') {
      if (state.lives < state.maxLives) state.lives += 1;
      addPopup(player.x, player.y - 24, '+1 LIFE!', POWERUPS.heart.color);
    } else if (type === 'bomb') {
      addPopup(player.x, player.y - 24, 'VOID BOMB!', POWERUPS.bomb.color);
      sfx.bomb();
      state.shake = 14;
      state.flashRed = 0.2;
      addFx(player.x, player.y, 'ring', 1, 0.5);
      [...state.enemies].forEach((enemy) => killEnemy(enemy, true));
      state.orbs.length = 0;
    }
    sfx.powerup();
  }

  function stepPlayer(dt, input) {
    const player = state.player;
    player.fireTimer -= dt;
    player.dashCooldown -= dt;
    player.invulnerable -= dt;
    player.spreadTimer -= dt;
    player.overdriveTimer -= dt;

    // Aim at the mouse; if it never moved, face the nearest enemy.
    let aimX = input.mouseX;
    let aimY = input.mouseY;
    if (aimX === 0 && aimY === 0 && state.enemies.length > 0) {
      let nearest = state.enemies[0];
      let bestDistance = Infinity;
      for (const enemy of state.enemies) {
        const d = distance(player.x, player.y, enemy.x, enemy.y);
        if (d < bestDistance) { bestDistance = d; nearest = enemy; }
      }
      aimX = nearest.x;
      aimY = nearest.y;
    }
    player.angle = Math.atan2(aimY - player.y, aimX - player.x);

    // Dash: a short burst toward the move direction (or the aim if idle).
    if (input.pressedDash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx === 0 && dy === 0) { dx = Math.cos(player.angle); dy = Math.sin(player.angle); }
      const length = Math.hypot(dx, dy) || 1;
      player.dashX = dx / length;
      player.dashY = dy / length;
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown * Math.pow(0.7, state.upgrades.swift || 0);
      sfx.dash();
      addParticles(player.x, player.y, '#4de8ff', 8, 120);
    }

    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
    } else {
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const length = Math.hypot(dx, dy) || 1;
      player.vx = (dx / length) * PLAYER.speed;
      player.vy = (dy / length) * PLAYER.speed;
    }
    player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, player.y + player.vy * dt));

    // Void wake: dashing through hunters damages them, once per dash each.
    if ((state.upgrades.wake || 0) > 0 && player.dashTimer > 0) {
      for (const enemy of state.enemies) {
        if (!enemy.wakeHitten && distance(player.x, player.y, enemy.x, enemy.y) < PLAYER.radius + enemy.radius + 8) {
          enemy.wakeHitten = true;
          enemy.hp -= 2;
          enemy.flash = 0.12;
          addParticles(enemy.x, enemy.y, '#e8f0ff', 6, 160);
          if (enemy.hp <= 0) killEnemy(enemy, true);
        }
      }
    } else if (player.dashTimer <= 0) {
      for (const enemy of state.enemies) enemy.wakeHitten = false;
    }

    // Fire: split shot stacks with the timed triple shot, up to 5 bullets.
    if (input.fire && player.fireTimer <= 0) {
      const interval = PLAYER.fireInterval * (player.overdriveTimer > 0 ? 0.5 : 1) * Math.pow(0.82, state.upgrades.rapid || 0);
      player.fireTimer = interval;
      state.shotsFired += 1;
      const count = Math.min(5, 1 + (state.upgrades.split || 0) + (player.spreadTimer > 0 ? 2 : 0));
      const angles = [];
      for (let i = 0; i < count; i += 1) angles.push((i - (count - 1) / 2) * 0.22);
      for (const offset of angles) {
        const angle = player.angle + offset;
        state.bullets.push({
          x: player.x + Math.cos(angle) * (PLAYER.radius + 6),
          y: player.y + Math.sin(angle) * (PLAYER.radius + 6),
          vx: Math.cos(angle) * BULLET.speed,
          vy: Math.sin(angle) * BULLET.speed,
          life: BULLET.life,
        });
      }
      sfx.shoot();
    }
  }

  function stepEnemies(dt) {
    const player = state.player;
    for (const enemy of state.enemies) {
      enemy.flash -= dt;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (enemy.kind === 'drifter' || enemy.kind === 'bulwark') {
        enemy.vx = (dx / dist) * enemy.speed;
        enemy.vy = (dy / dist) * enemy.speed;
      } else if (enemy.kind === 'dart') {
        enemy.modeTimer -= dt;
        if (enemy.mode === 0) {
          enemy.vx = (dx / dist) * enemy.speed * 0.55;
          enemy.vy = (dy / dist) * enemy.speed * 0.55;
          if (enemy.modeTimer <= 0) { enemy.mode = 1; enemy.modeTimer = 0.35; enemy.flash = 0.35; }
        } else if (enemy.mode === 1) {
          enemy.vx = 0;
          enemy.vy = 0;
          if (enemy.modeTimer <= 0) {
            enemy.mode = 2;
            enemy.modeTimer = 0.5;
            enemy.vx = (dx / dist) * enemy.speed * 2.8;
            enemy.vy = (dy / dist) * enemy.speed * 2.8;
            enemy.angle = Math.atan2(dy, dx);
          }
        } else {
          if (enemy.modeTimer <= 0) { enemy.mode = 0; enemy.modeTimer = 1.2 + random() * 1.2; }
        }
      } else if (enemy.kind === 'spinner') {
        // Keep a ring around the player and fire slow orbs.
        const want = 230;
        const toward = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
        enemy.vx = (dx / dist) * enemy.speed * toward + (-dy / dist) * enemy.speed * 0.5;
        enemy.vy = (dy / dist) * enemy.speed * toward + (dx / dist) * enemy.speed * 0.5;
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0 && dist < 520) {
          enemy.fireTimer = 1.8;
          enemy.flash = 0.25;
          state.orbs.push({
            x: enemy.x,
            y: enemy.y,
            vx: (dx / dist) * ORB.speed,
            vy: (dy / dist) * ORB.speed,
            life: 5,
          });
          sfx.hit();
        }
      } else if (enemy.kind === 'boss') {
        // Chase slowly, burst orbs in a ring, telegraph a charge, and
        // trickle in drifter minions while it lives.
        enemy.burstTimer -= dt;
        if (enemy.burstTimer <= 0) {
          enemy.burstTimer = BOSS.burstInterval;
          enemy.flash = 0.3;
          for (let i = 0; i < BOSS.burstCount; i += 1) {
            const angle = (i / BOSS.burstCount) * Math.PI * 2;
            state.orbs.push({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(angle) * ORB.speed,
              vy: Math.sin(angle) * ORB.speed,
              life: 5,
            });
          }
          sfx.hit();
        }
        enemy.minionTimer -= dt;
        if (enemy.minionTimer <= 0 && state.enemies.length < 24) {
          enemy.minionTimer = BOSS.minionInterval;
          for (let i = 0; i < BOSS.minionBatch; i += 1) {
            const child = makeEnemy(random, state, 'drifter');
            child.x = enemy.x + (i === 0 ? -50 : 50);
            child.y = enemy.y;
            state.enemies.push(child);
          }
        }
        enemy.modeTimer -= dt;
        if (enemy.mode === 0) {
          enemy.vx = (dx / dist) * enemy.speed;
          enemy.vy = (dy / dist) * enemy.speed;
          if (enemy.modeTimer <= 0) {
            enemy.mode = 1;
            enemy.modeTimer = BOSS.chargeTelegraph;
            enemy.flash = BOSS.chargeTelegraph;
          }
        } else if (enemy.mode === 1) {
          enemy.vx = 0;
          enemy.vy = 0;
          if (enemy.modeTimer <= 0) {
            enemy.mode = 2;
            enemy.modeTimer = 0.6;
            enemy.vx = (dx / dist) * BOSS.chargeSpeed;
            enemy.vy = (dy / dist) * BOSS.chargeSpeed;
            enemy.angle = Math.atan2(dy, dx);
          }
        } else if (enemy.modeTimer <= 0) {
          enemy.mode = 0;
          enemy.modeTimer = 2.5 + random() * 2;
        }
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.x = Math.max(enemy.radius, Math.min(FIELD.width - enemy.radius, enemy.x));
      enemy.y = Math.max(enemy.radius, Math.min(FIELD.height - enemy.radius, enemy.y));
      enemy.angle = Math.atan2(enemy.vy, enemy.vx);
    }
    // Gentle separation so hunters do not stack on one point.
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const d = distance(a.x, a.y, b.x, b.y);
        const min = a.radius + b.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  function stepBullets(dt) {
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
    }
    state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < FIELD.width + 20 && b.y > -20 && b.y < FIELD.height + 20);
    for (const orb of state.orbs) {
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.life -= dt;
    }
    state.orbs = state.orbs.filter((o) => o.life > 0 && o.x > -20 && o.x < FIELD.width + 20 && o.y > -20 && o.y < FIELD.height + 20);
  }

  function stepCollisions() {
    // Bullets against enemies.
    for (let bi = state.bullets.length - 1; bi >= 0; bi -= 1) {
      const bullet = state.bullets[bi];
      let consumed = false;
      for (const enemy of [...state.enemies]) {
        if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < BULLET.radius + enemy.radius) {
          state.shotsHit += 1;
          enemy.hp -= BULLET.damage + (state.upgrades.heavy || 0);
          enemy.flash = 0.12;
          addParticles(bullet.x, bullet.y, '#bff6ff', 4, 140);
          sfx.hit();
          state.bullets.splice(bi, 1);
          consumed = true;
          if (enemy.hp <= 0) killEnemy(enemy, true);
          break;
        }
      }
      if (consumed) continue;
    }
    // Enemies against the player.
    const player = state.player;
    for (const enemy of [...state.enemies]) {
      if (distance(player.x, player.y, enemy.x, enemy.y) < PLAYER.radius + enemy.radius - 3) {
        hurtPlayer();
        // Knock the enemy back a little so one touch is not two.
        enemy.x += (enemy.x - player.x) * 0.4;
        enemy.y += (enemy.y - player.y) * 0.4;
        if (state.screen !== SCREEN_PLAY) return;
      }
    }
    // Orbs against the player.
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const orb = state.orbs[i];
      if (distance(orb.x, orb.y, player.x, player.y) < ORB.radius + PLAYER.radius - 3) {
        state.orbs.splice(i, 1);
        hurtPlayer();
        if (state.screen !== SCREEN_PLAY) return;
      }
    }
    // Power-ups against the player.
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const powerup = state.powerups[i];
      if (distance(powerup.x, powerup.y, player.x, player.y) < POWERUPS.radius + PLAYER.radius) {
        state.powerups.splice(i, 1);
        applyPowerup(powerup.type);
      }
    }
  }

  function stepSpawning(dt) {
    if (state.waveState === 'spawning') {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
        const interval = Math.max(WAVES.spawnMinInterval, WAVES.spawnInterval - (state.wave - 1) * WAVES.intervalShrink);
        state.spawnTimer = interval;
        state.enemies.push(makeEnemy(random, state, state.spawnQueue.shift()));
      }
      if (state.spawnQueue.length === 0) state.waveState = 'fighting';
    } else if (state.waveState === 'fighting') {
      if (state.enemies.length === 0) clearWave();
    }
  }

  function stepFx(dt) {
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const popup of state.popups) {
      popup.y -= FEEL.popupRise * dt;
      popup.life -= dt;
    }
    state.popups = state.popups.filter((p) => p.life > 0);
    for (const effect of state.fx) effect.age += dt;
    state.fx = state.fx.filter((f) => f.age < f.duration);
    for (const powerup of state.powerups) {
      powerup.y += POWERUPS.fallSpeed * dt * 0.4;
      powerup.bob += dt * 3;
      powerup.life -= dt;
      // Void magnet: power-ups fly to the player.
      if ((state.upgrades.magnet || 0) > 0) {
        const dx = state.player.x - powerup.x;
        const dy = state.player.y - powerup.y;
        const d = Math.hypot(dx, dy) || 1;
        powerup.x += (dx / d) * 260 * dt;
        powerup.y += (dy / d) * 260 * dt;
      }
    }
    state.powerups = state.powerups.filter((p) => p.life > 0 && p.y < FIELD.height + 20);
    state.shake = Math.max(0, state.shake - dt * 26);
    state.flashRed = Math.max(0, state.flashRed - dt);
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
  }

  function stepTitle(dt) {
    // Ambient drift behind the title: a few hunters wander, sparks float.
    if (state.enemies.length < 6 && random() < dt * 0.8) {
      const kind = pick(random, ['drifter', 'dart', 'spinner']);
      const enemy = makeEnemy(random, state, kind);
      state.enemies.push(enemy);
    }
    for (const enemy of state.enemies) {
      enemy.x += Math.cos(enemy.angle) * enemy.speed * 0.4 * dt;
      enemy.y += Math.sin(enemy.angle) * enemy.speed * 0.4 * dt;
      enemy.angle += dt * 0.3;
      if (enemy.x < 20 || enemy.x > FIELD.width - 20) enemy.angle = Math.PI - enemy.angle;
      if (enemy.y < 20 || enemy.y > FIELD.height - 20) enemy.angle = -enemy.angle;
    }
    stepFx(dt);
  }

  const world = {
    state,
    applyDraft,
    openDraft,
    reset() {
      const keepBest = state.best;
      const keepMuted = state.muted;
      Object.assign(state, freshState());
      state.best = keepBest;
      state.muted = keepMuted;
    },
    start() {
      world.reset();
      state.screen = SCREEN_PLAY;
      state.lives = PLAYER.lives;
      startWave(1);
    },
    step(dt, input) {
      if (state.hitStop > 0) {
        state.hitStop -= dt;
        return;
      }
      if (state.screen === SCREEN_TITLE) {
        stepTitle(dt);
        return;
      }
      if (state.screen === SCREEN_DRAFT) {
        // The draft waits for a pick: the world only animates behind it.
        if (input.draftPick != null && input.draftPick >= 0) applyDraft(input.draftPick);
        stepFx(dt);
        return;
      }
      if (state.screen !== SCREEN_PLAY) {
        stepFx(dt);
        return;
      }
      state.timePlayed += dt;
      stepPlayer(dt, input);
      stepEnemies(dt);
      stepBullets(dt);
      stepCollisions();
      if (state.screen !== SCREEN_PLAY) return;
      stepSpawning(dt);
      stepFx(dt);
    },
  };
  return world;
}

// The fixed step the loop and the staged shots advance by.
export { STEP };
