// VOIDLIGHT's drawing: one canvas, one neon palette, every screen the game
// has. The HUD is drawn on the same canvas so a screenshot always shows the
// whole game — score, wave, lives, combo and power-ups — exactly as the
// player sees it.
import { FIELD, PLAYER, BULLET, ENEMIES, POWERUPS, COMBO, PALETTE, FEEL, UPGRADES } from './config.js';
import { makeRandom } from './random.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_DRAFT, SCREEN_OVER, SCREEN_WIN } from './world.js';

// The boss's 3D-rendered sprite (Blender, transparent PNG, 512x512; the
// render's content fills about 70% of the frame). It loads once, from a
// static file beside the game, so the game still runs fully offline. If it
// fails to load, the boss falls back to the procedural spiked core below.
const bossImage = new Image();
bossImage.src = 'assets/boss.png';
const bossFirstSeen = new WeakMap();
function bossSpriteReady() {
  return bossImage.complete && bossImage.naturalWidth > 0;
}
// Entrance scale: 0 on arrival, overshoots slightly, settles at 1.
function bossEntranceScale(age) {
  const t = Math.min(1, age / 0.6);
  return 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
}

// 3D-rendered attack effects (Blender, transparent PNGs). Each is drawn
// only when its file has loaded; otherwise the game falls back to the
// procedural particles, dots and shake it already had.
const explosionFrames = [];
for (let i = 0; i < 10; i += 1) {
  const frame = new Image();
  frame.src = `assets/fx/exp-0${i}.png`;
  explosionFrames.push(frame);
}
const boltImage = new Image();
boltImage.src = 'assets/fx/bolt.png';
const ringImage = new Image();
ringImage.src = 'assets/fx/ring.png';
function imageReady(image) {
  return image.complete && image.naturalWidth > 0;
}

// A fixed starfield, the same on every run.
const stars = (() => {
  const random = makeRandom(1337);
  const list = [];
  for (let i = 0; i < 90; i += 1) {
    list.push({
      x: random() * FIELD.width,
      y: random() * FIELD.height,
      size: 0.6 + random() * 1.6,
      twinkle: random() * Math.PI * 2,
    });
  }
  return list;
})();

function drawBackground(ctx, time) {
  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  const step = 48;
  ctx.beginPath();
  for (let x = step; x < FIELD.width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD.height);
  }
  for (let y = step; y < FIELD.height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
  }
  ctx.stroke();
  for (const star of stars) {
    const alpha = 0.25 + 0.3 * Math.abs(Math.sin(time * 0.7 + star.twinkle));
    ctx.fillStyle = `rgba(220, 235, 255, ${alpha.toFixed(3)})`;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
}

function drawPlayer(ctx, state, time) {
  const player = state.player;
  if (player.invulnerable > 0 && Math.floor(time * 14) % 2 === 0) return; // blink while invulnerable
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.moveTo(PLAYER.radius + 6, 0);
  ctx.lineTo(-PLAYER.radius * 0.8, PLAYER.radius * 0.75);
  ctx.lineTo(-PLAYER.radius * 0.35, 0);
  ctx.lineTo(-PLAYER.radius * 0.8, -PLAYER.radius * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (player.shield) {
    ctx.save();
    ctx.strokeStyle = '#5df2a6';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#5df2a6';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (player.dashTimer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(77, 232, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x - player.dashX * 34, player.y - player.dashY * 34);
    ctx.lineTo(player.x, player.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, enemy, time) {
  const spec = ENEMIES[enemy.kind];
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = enemy.flash > 0 ? 22 : 12;
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
  ctx.strokeStyle = enemy.color;
  ctx.lineWidth = 2;
  if (enemy.kind === 'drifter') {
    ctx.rotate(enemy.angle);
    ctx.beginPath();
    ctx.moveTo(enemy.radius, 0);
    ctx.lineTo(-enemy.radius * 0.8, enemy.radius * 0.85);
    ctx.lineTo(-enemy.radius * 0.8, -enemy.radius * 0.85);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'dart') {
    ctx.rotate(time * 2.4);
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius);
    ctx.lineTo(enemy.radius, 0);
    ctx.lineTo(0, enemy.radius);
    ctx.lineTo(-enemy.radius, 0);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'spinner') {
    ctx.rotate(time * 1.2);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * enemy.radius;
      const y = Math.sin(angle) * enemy.radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#070a1a';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'boss') {
    // A huge spiked core with a health bar and a name tag. The 3D render
    // spins slowly and scales in on arrival; the procedural shape below is
    // the fallback if the sprite has not loaded.
    if (bossSpriteReady()) {
      if (!bossFirstSeen.has(enemy)) bossFirstSeen.set(enemy, time);
      const scale = bossEntranceScale(time - bossFirstSeen.get(enemy));
      const size = (enemy.radius * 2 / 0.695) * scale;
      ctx.rotate(time * 0.7);
      ctx.drawImage(bossImage, -size / 2, -size / 2, size, size);
    } else {
      ctx.rotate(time * 0.7);
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const outer = i % 2 === 0 ? enemy.radius : enemy.radius * 0.62;
        const x = Math.cos(angle) * outer;
        const y = Math.sin(angle) * outer;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#070a1a';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    const barWidth = enemy.radius * 2;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 14, barWidth, 5);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 14, barWidth * ratio, 5);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOSS', enemy.x, enemy.y - enemy.radius - 24);
    return;
  } else {
    // Bulwark: a heavy square with an inner core and a health bar.
    ctx.rotate(Math.PI / 4 + Math.sin(time * 0.8) * 0.08);
    ctx.fillRect(-enemy.radius * 0.8, -enemy.radius * 0.8, enemy.radius * 1.6, enemy.radius * 1.6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#070a1a';
    ctx.fillRect(-enemy.radius * 0.35, -enemy.radius * 0.35, enemy.radius * 0.7, enemy.radius * 0.7);
    ctx.restore();
    const barWidth = enemy.radius * 2;
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth, 4);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth * ratio, 4);
    return;
  }
  ctx.restore();
}

function drawFx(ctx, state) {
  for (const effect of state.fx) {
    const progress = effect.age / effect.duration;
    if (effect.kind === 'explosion') {
      const frame = explosionFrames[Math.min(9, Math.floor(progress * 10))];
      if (!imageReady(frame)) continue;
      const size = 90 * effect.scale;
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = 24;
      ctx.globalAlpha = 1 - progress * 0.5;
      ctx.drawImage(frame, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else if (effect.kind === 'ring') {
      if (!imageReady(ringImage)) continue;
      const size = (60 + progress * 340) * effect.scale;
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.shadowColor = '#4de8ff';
      ctx.shadowBlur = 18;
      ctx.drawImage(ringImage, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }
}

function drawBullets(ctx, state) {
  ctx.save();
  ctx.shadowColor = PALETTE.bullet;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = PALETTE.bullet;
  ctx.fillStyle = PALETTE.bullet;
  ctx.lineWidth = 2;
  for (const bullet of state.bullets) {
    if (imageReady(boltImage)) {
      // A 3D-rendered plasma bolt, spun to the bullet's flight direction.
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
      ctx.drawImage(boltImage, -12, -6, 24, 12);
      ctx.restore();
      continue;
    }
    // A short trail so a shot reads as motion, not a dot.
    ctx.beginPath();
    ctx.moveTo(bullet.x - bullet.vx * 0.03, bullet.y - bullet.vy * 0.03);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, BULLET.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.shadowColor = '#ffb02e';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffb02e';
  for (const orb of state.orbs) {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const POWERUP_GLYPH = { spread: 'T', shield: 'O', overdrive: 'F', heart: '+', bomb: 'B' };
const POWERUP_LABEL = { spread: 'TRIPLE', shield: 'SHIELD', overdrive: 'OVERDRIVE', heart: 'LIFE', bomb: 'BOMB' };

function drawPowerups(ctx, state, time) {
  for (const powerup of state.powerups) {
    const bob = Math.sin(powerup.bob) * 3;
    const blink = powerup.life < 2 ? (Math.floor(time * 8) % 2 === 0 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(powerup.x, powerup.y + bob);
    ctx.shadowColor = powerup.color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = powerup.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, POWERUPS.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10, 16, 42, 0.7)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = powerup.color;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_GLYPH[powerup.type], 0, 1);
    ctx.restore();
  }
}

function drawParticles(ctx, state) {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx, state) {
  ctx.save();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const popup of state.popups) {
    ctx.globalAlpha = Math.max(0, popup.life / popup.maxLife);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawHearts(ctx, x, y, lives) {
  ctx.save();
  ctx.font = '18px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let heart = '';
  for (let i = 0; i < lives; i += 1) heart += '♥';
  ctx.fillStyle = '#ff5d7a';
  ctx.shadowColor = '#ff5d7a';
  ctx.shadowBlur = 8;
  ctx.fillText(heart, x, y);
  ctx.restore();
}

function drawHud(ctx, state) {
  const player = state.player;
  ctx.save();
  // Score, top left.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('SCORE', 18, 14);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(String(state.score), 18, 30);
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(`BEST ${Math.max(state.best, state.score)}`, 18, 66);
  // Combo meter under the score.
  if (state.combo > 1) {
    const multiplier = Math.min(state.combo, COMBO.max);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`COMBO x${multiplier}`, 18, 88);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(18, 110, 110, 5);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(18, 110, 110 * Math.max(0, state.comboTimer / COMBO.window), 5);
  }
  // Wave, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('WAVE', FIELD.width / 2, 14);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`${Math.max(1, state.wave)} / 10`, FIELD.width / 2, 30);
  const remaining = state.enemies.length + state.spawnQueue.length;
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(state.waveState === 'clear' ? 'WAVE CLEARED' : `${remaining} HOSTILE${remaining === 1 ? '' : 'S'} LEFT`, FIELD.width / 2, 66);
  // Lives, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('LIVES', FIELD.width - 18, 14);
  drawHearts(ctx, FIELD.width - 18 - 66, 44, state.lives);
  // Active power-ups, right side under the lives.
  let row = 0;
  const active = [];
  if (player.spreadTimer > 0) active.push(`TRIPLE ${Math.ceil(player.spreadTimer)}s`);
  if (player.overdriveTimer > 0) active.push(`OVERDRIVE ${Math.ceil(player.overdriveTimer)}s`);
  if (player.shield) active.push('SHIELD');
  for (const label of active) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(label, FIELD.width - 18, 74 + row * 18);
    row += 1;
  }
  // Owned draft upgrades as compact glyphs, right side under the rest.
  const owned = Object.keys(state.upgrades);
  if (owned.length > 0) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(owned.map((id) => `${UPGRADES[id].glyph}${state.upgrades[id] > 1 ? state.upgrades[id] : ''}`).join('  '), FIELD.width - 18, 74 + row * 18);
    row += 1;
  }
  // Dash cooldown, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('DASH [SHIFT]', 18, FIELD.height - 34);
  const dashMax = PLAYER.dashCooldown * Math.pow(0.7, state.upgrades.swift || 0);
  const dashRatio = player.dashCooldown <= 0 ? 1 : 1 - player.dashCooldown / dashMax;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(18, FIELD.height - 20, 90, 5);
  ctx.fillStyle = dashRatio >= 1 ? '#4de8ff' : '#8fa3d9';
  ctx.fillRect(18, FIELD.height - 20, 90 * dashRatio, 5);
  // Controls hint, bottom right.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('WASD MOVE · MOUSE AIM · CLICK FIRE · P PAUSE · M MUTE', FIELD.width - 18, FIELD.height - 26);
  ctx.restore();
}

function drawBanner(ctx, state) {
  if (state.bannerTimer <= 0 || !state.banner) return;
  const alpha = Math.min(1, state.bannerTimer);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#4de8ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#e8f0ff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(state.banner, FIELD.width / 2, FIELD.height / 2 - 90);
  ctx.restore();
}

function drawPanel(ctx, x, y, width, height) {
  ctx.save();
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTitle(ctx, state) {
  drawPanel(ctx, FIELD.width / 2 - 300, 128, 600, 384);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#4de8ff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#e8f0ff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('VOIDLIGHT', FIELD.width / 2, 196);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd94d';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText('CLEAR 10 WAVES. SURVIVE THE VOID.', FIELD.width / 2, 246);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '16px system-ui, sans-serif';
  const lines = [
    'WASD / arrows — move      Mouse — aim      Click / Space — fire',
    'Shift / right-click — dash through danger',
    'Clear a wave, draft 1 of 3 upgrades. Bosses guard waves 5 and 10.',
    'Darts telegraph before they lunge. Bulwarks split in two when they die.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 292 + i * 28));
  ctx.fillStyle = '#4de8ff';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO START', FIELD.width / 2, 440);
  if (state.best > 0) {
    ctx.fillStyle = PALETTE.dimText;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE ${state.best}`, FIELD.width / 2, 478);
  }
  ctx.restore();
}

function drawStats(ctx, state, y) {
  const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
  const minutes = Math.floor(state.timePlayed / 60);
  const seconds = Math.floor(state.timePlayed % 60).toString().padStart(2, '0');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`KILLS ${state.kills}    ACCURACY ${accuracy}%    TIME ${minutes}:${seconds}    WAVE ${Math.max(1, state.wave)}`, FIELD.width / 2, y);
  ctx.restore();
}

function drawOver(ctx, state) {
  drawPanel(ctx, FIELD.width / 2 - 280, 150, 560, 340);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff5d7a';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ff5d7a';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('GAME OVER', FIELD.width / 2, 214);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('THE VOID GOT YOU', FIELD.width / 2, 256);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(String(state.score), FIELD.width / 2, 310);
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(`BEST ${Math.max(state.best, state.score)}`, FIELD.width / 2, 344);
  drawStats(ctx, state, 384);
  ctx.fillStyle = '#4de8ff';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO TRY AGAIN', FIELD.width / 2, 440);
  ctx.restore();
}

function drawWin(ctx, state) {
  drawPanel(ctx, FIELD.width / 2 - 280, 150, 560, 340);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffd94d';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.fillText('VOID CLEARED!', FIELD.width / 2, 212);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('ALL 10 WAVES DOWN. THE VOID IS YOURS.', FIELD.width / 2, 254);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(String(state.score), FIELD.width / 2, 310);
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(`BEST ${Math.max(state.best, state.score)}`, FIELD.width / 2, 344);
  drawStats(ctx, state, 384);
  ctx.fillStyle = '#4de8ff';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', FIELD.width / 2, 440);
  ctx.restore();
}

function drawDraft(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 10, 26, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffd94d';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillText(`WAVE ${state.wave} CLEARED — CHOOSE AN UPGRADE`, FIELD.width / 2, 104);
  ctx.shadowBlur = 0;
  const cardWidth = 240;
  const cardHeight = 210;
  const gap = 28;
  const total = cardWidth * 3 + gap * 2;
  const startX = (FIELD.width - total) / 2;
  const y = 168;
  state.draftRects = [];
  state.draft.forEach((id, i) => {
    const spec = UPGRADES[id];
    const level = state.upgrades[id] || 0;
    const x = startX + i * (cardWidth + gap);
    state.draftRects.push({ x, y, width: cardWidth, height: cardHeight });
    drawPanel(ctx, x, y, cardWidth, cardHeight);
    ctx.fillStyle = spec.color;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(spec.glyph, x + cardWidth / 2, y + 56);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(spec.name, x + cardWidth / 2, y + 110);
    ctx.fillStyle = PALETTE.dimText;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(spec.desc, x + cardWidth / 2, y + 140);
    ctx.fillStyle = spec.color;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(level > 0 ? `OWNED Lv${level} — PRESS ${i + 1} FOR Lv${level + 1}` : `NEW — PRESS ${i + 1}`, x + cardWidth / 2, y + 172);
  });
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('PRESS 1 / 2 / 3 OR CLICK A CARD', FIELD.width / 2, 438);
  ctx.restore();
}

function drawPaused(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(7, 10, 26, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8f0ff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('PRESS P TO RESUME', FIELD.width / 2, FIELD.height / 2 + 34);
  ctx.restore();
}

export function render(ctx, state, time) {
  ctx.save();
  if (state.shake > 0) {
    const magnitude = state.shake;
    ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
  }
  drawBackground(ctx, time);
  if (state.screen === SCREEN_TITLE) {
    for (const enemy of state.enemies) drawEnemy(ctx, enemy, time);
    drawParticles(ctx, state);
    drawTitle(ctx, state);
  } else {
    for (const enemy of state.enemies) drawEnemy(ctx, enemy, time);
    drawPowerups(ctx, state, time);
    drawBullets(ctx, state);
    if (state.screen !== SCREEN_OVER && state.screen !== SCREEN_WIN) drawPlayer(ctx, state, time);
    drawParticles(ctx, state);
    drawFx(ctx, state);
    drawPopups(ctx, state);
    drawHud(ctx, state);
    drawBanner(ctx, state);
    if (state.screen === SCREEN_DRAFT) drawDraft(ctx, state);
    if (state.screen === SCREEN_OVER) drawOver(ctx, state);
    if (state.screen === SCREEN_WIN) drawWin(ctx, state);
    if (state.paused) drawPaused(ctx);
  }
  if (state.flashRed > 0) {
    ctx.fillStyle = `rgba(255, 60, 90, ${(state.flashRed * 0.45).toFixed(3)})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  ctx.restore();
}
