// The 2D overlay: title screen, HUD cards, the weapon wheel with drawn profiles,
// the detailed minimap and pause-menu map (with the shoe glyph at PBPD HQ),
// story/stats/controls tabs, dialogue, toasts and the driving speedo. Everything
// here is screen-space canvas art; the world behind it is true 3D.
import { drawWeaponProfile, WEAPON_INFO, WEAPON_ORDER } from './weaponart.js';
import { WORLD, districtAt } from './world.js';

const PANEL = 'rgba(12,15,21,0.80)';
const PANEL_EDGE = 'rgba(255,255,255,0.14)';
const MAGENTA = '#e83e8c';
const GOLD = '#f2b63c';

function panel(ctx, x, y, w, h, r = 10) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = PANEL; ctx.fill();
  ctx.strokeStyle = PANEL_EDGE; ctx.lineWidth = 1; ctx.stroke();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fill();
}
function txt(ctx, s, x, y, font, color, align = 'left') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}
function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}
function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? GOLD : 'rgba(255,255,255,0.22)'; ctx.fill();
}
/** Tiny high-heel glyph for the maps. */
export function drawHeel(ctx, x, y, s, color = '#ff5fa8') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 24, s / 24);
  ctx.beginPath();
  ctx.moveTo(-10, -6); ctx.bezierCurveTo(-2, -9, 4, -6, 7, -1);
  ctx.bezierCurveTo(9, 2, 11, 3, 13, 3.4); ctx.lineTo(13.8, 3.4); ctx.lineTo(13.2, 10); ctx.lineTo(10.6, 10);
  ctx.bezierCurveTo(10.2, 5.4, 9, 4, 6, 3.2); ctx.bezierCurveTo(0, 1.6, -6, 1.6, -9.4, -0.6);
  ctx.bezierCurveTo(-11.4, -2.2, -11.6, -4.2, -10, -6);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
function drawMapBase(ctx, cx, cy, size, big) {
  const scale = size / 480;
  const px = (wx) => cx + (wx - WORLD.minX) * scale;
  const pz = (wz) => cy + (wz - WORLD.minZ) * scale;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx, cy, size, size); ctx.clip();
  ctx.fillStyle = '#274b5c'; ctx.fillRect(cx, cy, size, size); // water
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 8; i++) { const y = pz(-140 - i * 9); ctx.fillRect(px(-220 + (i % 3) * 40), y, 60, 1.4); ctx.fillRect(px(60 - (i % 2) * 30), y + 3, 44, 1.4); } // wave ticks
  ctx.fillStyle = '#c9ad7e'; ctx.fillRect(cx, pz(WORLD.shoreZ) - 14 * scale, size, 16 * scale); // sand rim
  ctx.fillStyle = '#7c7a72'; ctx.fillRect(cx, pz(WORLD.shoreZ), size, size - (pz(WORLD.shoreZ) - cy)); // land
  if (big) { // district tints + labels
    ctx.fillStyle = 'rgba(232,62,140,0.07)'; ctx.fillRect(px(-230), pz(-118), px(230) - px(-230), pz(-84) - pz(-118));
    ctx.fillStyle = 'rgba(242,182,60,0.08)'; ctx.fillRect(px(-132), pz(-84), px(132) - px(-132), pz(196) - pz(-84));
    ctx.fillStyle = 'rgba(90,160,220,0.10)'; ctx.fillRect(px(132), pz(-118), px(230) - px(132), pz(196) - pz(-118));
    ctx.fillStyle = 'rgba(120,200,120,0.10)'; ctx.fillRect(px(-230), pz(60), px(-132) - px(-230), pz(196) - pz(60));
    ctx.fillStyle = 'rgba(240,240,235,0.85)'; ctx.font = `bold ${Math.max(9, size * 0.026)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('BEACHFRONT', px(0), pz(-96)); ctx.fillText('DOWNTOWN', px(0), pz(40));
    ctx.fillText('PORT', px(182), pz(20)); ctx.fillText('OBSERVATORY HILL', px(-182), pz(112));
    ctx.fillText('MUSCLE SANDS', px(96), pz(-96));
  }
  ctx.fillStyle = '#8f8c85';
  for (const b of WORLD.blocks) ctx.fillRect(px(b.x0), pz(b.z0), (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale); // hashed blocks base
  ctx.strokeStyle = 'rgba(52,52,55,0.5)'; ctx.lineWidth = 1;
  for (const b of WORLD.blocks) ctx.strokeRect(px(b.x0), pz(b.z0), (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale);
  ctx.fillStyle = '#3d3f42'; // cased roads
  for (const x of WORLD.avenues) ctx.fillRect(px(x) - 7 * scale, pz(-108), 14 * scale, pz(196) - pz(-108));
  for (const z of WORLD.streets) ctx.fillRect(px(-230), pz(z) - 7 * scale, size, 14 * scale);
  ctx.fillStyle = '#8a6f4d'; // pier
  ctx.fillRect(px(WORLD.pier.x0), pz(WORLD.pier.z0), (WORLD.pier.x1 - WORLD.pier.x0) * scale, (WORLD.pier.z1 - WORLD.pier.z0) * scale);
  ctx.strokeStyle = '#d8dde2'; ctx.lineWidth = Math.max(1.4, size * 0.004); // wheel ring
  ctx.beginPath(); ctx.arc(px(WORLD.wheel.x), pz(WORLD.wheel.z), WORLD.wheel.r * scale, 0, 7); ctx.stroke();
  ctx.fillStyle = '#6d5136'; ctx.fillRect(px(WORLD.cranes[0].x) - 3, pz(WORLD.cranes[0].z) - 3, 6, 6); ctx.fillRect(px(WORLD.cranes[1].x) - 3, pz(WORLD.cranes[1].z) - 3, 6, 6);
  ctx.fillStyle = '#e8e6da'; ctx.beginPath(); ctx.arc(px(WORLD.lighthouse.x), pz(WORLD.lighthouse.z), Math.max(2, size * 0.008), 0, 7); ctx.fill();
  ctx.restore();
  return { px, pz, scale };
}
function marker(ctx, x, y, letter, color) {
  ctx.beginPath(); ctx.arc(x, y, 8, 0, 7);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
  txt(ctx, letter, x, y + 3.6, 'bold 9.5px sans-serif', '#fff', 'center');
}

export class HUD {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.canvas = canvas;
    this.buttons = []; // {id,x,y,w,h}
    this.mapRect = null;
  }
  button(id, x, y, w, h, label, accent) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, accent ? '#8e2455' : 'rgba(38,44,54,0.92)');
    g.addColorStop(1, accent ? '#5f1739' : 'rgba(20,24,31,0.92)');
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 9);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = accent ? MAGENTA : PANEL_EDGE; ctx.stroke();
    txt(ctx, label, x + w / 2, y + h / 2 + 5, 'bold 15px sans-serif', '#f2f0ea', 'center');
    this.buttons.push({ id, x, y, w, h });
  }
  hit(x, y) {
    for (const b of this.buttons) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    return null;
  }

  /** Erase the whole overlay. The main loop calls this exactly once per
   *  frame, before the frame's first draw: without it, translucent panels
   *  and veils stack across frames and the title art ghosts over gameplay
   *  forever. Wheel and pause draw AFTER the HUD in the same frame and
   *  overlay it, so they must never clear on their own. */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawTitle(S) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    this.buttons = [];
    const g = ctx.createLinearGradient(0, H * 0.52, 0, H);
    g.addColorStop(0, 'rgba(10,8,14,0)'); g.addColorStop(1, 'rgba(10,8,14,0.72)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    txt(ctx, 'PALMERA', W / 2, H * 0.66, 'bold 84px sans-serif', '#f5efe2', 'center');
    txt(ctx, 'HEAT IV', W / 2, H * 0.66 + 62, 'bold 40px sans-serif', MAGENTA, 'center');
    txt(ctx, 'An original Palmera Bay crime story — no kings, only rent due.', W / 2, H * 0.66 + 92, '14px sans-serif', 'rgba(240,238,230,0.85)', 'center');
    const bw = 230, bx = W / 2 - bw / 2;
    if (S.hasSave) this.button('continue', bx, H * 0.8, bw, 44, 'CONTINUE', true);
    this.button('new', bx, H * 0.8 + (S.hasSave ? 54 : 0), bw, 44, 'NEW GAME', !S.hasSave);
    txt(ctx, window.__palmeraTouch ? 'Left thumb move · Right thumb look · FIRE shoots · WHEEL picks a gun' : 'WASD drive / walk · Mouse look · LMB fire · Tab wheel · F enter car · M map', W / 2, H - 16, '12.5px sans-serif', 'rgba(240,238,230,0.6)', 'center');
  }

  drawMinimap(S) {
    const ctx = this.ctx;
    const size = 168, cx = 18, cy = this.canvas.height - size - 46;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx + size / 2, cy + size / 2, size / 2, 0, 7); ctx.fillStyle = '#274b5c'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx + size / 2, cy + size / 2, size / 2, 0, 7); ctx.clip();
    ctx.fillStyle = '#7c7a72'; // land mass relative to the shore
    const shoreY = cy + size / 2 + (WORLD.shoreZ - S.player.z) * 1.7;
    ctx.fillRect(cx, shoreY, size, cy + size - shoreY);
    ctx.fillStyle = '#c9ad7e'; ctx.fillRect(cx, shoreY - 5, size, 6); // sand rim
    const scale = 1.7;
    const proj = (wx, wz) => [cx + size / 2 + (wx - S.player.x) * scale, cy + size / 2 + (wz - S.player.z) * scale];
    // roads near player
    ctx.strokeStyle = 'rgba(30,30,33,0.85)'; ctx.lineWidth = 5;
    for (const x of WORLD.avenues) { const [a] = proj(x, 0); ctx.beginPath(); ctx.moveTo(a, cy); ctx.lineTo(a, cy + size); ctx.stroke(); }
    for (const z of WORLD.streets) { const [, b] = proj(0, z); ctx.beginPath(); ctx.moveTo(cx, b); ctx.lineTo(cx + size, b); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(90,150,180,0.9)'; ctx.lineWidth = 7;
    { const [, b] = proj(0, WORLD.shoreZ); ctx.beginPath(); ctx.moveTo(cx, b); ctx.lineTo(cx + size, b); ctx.stroke(); }
    const dot = (wx, wz, letter, color) => { const [a, b] = proj(wx, wz); if (a > cx - 6 && a < cx + size + 6 && b > cy - 6 && b < cy + size + 6) marker(ctx, a, b, letter, color); };
    dot(WORLD.ghost.x, WORLD.ghost.z, 'G', '#c23a7d');
    dot(WORLD.garage.x, WORLD.garage.z, 'H', '#3f7d5a');
    dot(WORLD.sahurSpot.x, WORLD.sahurSpot.z, 'S', '#8a6a3a');
    if (S.target) dot(S.target.x, S.target.z, '!', '#c9403a');
    { const [a, b] = proj(WORLD.hq.x, WORLD.hq.z); if (a > cx && a < cx + size && b > cy && b < cy + size) drawHeel(ctx, a, b, 15); }
    // player arrow
    ctx.translate(cx + size / 2, cy + size / 2); ctx.rotate(-S.player.yaw);
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.4, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.4, 6); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx + size / 2, cy + size / 2, size / 2, 0, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, S.street, cx + 6, this.canvas.height - 24, '12px sans-serif', 'rgba(240,238,230,0.9)');
    txt(ctx, S.district + ' · standing ' + S.standing, cx + 6, this.canvas.height - 9, '11px sans-serif', 'rgba(240,238,230,0.6)');
  }

  drawHUD(S) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    // vignette — a whisper at the very corners only; the scene stays lit
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.66, W / 2, H / 2, H * 1.3);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(5,4,10,0.15)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // mission card (below the health panel, which owns the top-left corner)
    if (S.mission) {
      panel(ctx, 16, 84, 308, 64);
      txt(ctx, '◆ ' + S.mission.title, 30, 108, 'bold 13.5px sans-serif', GOLD);
      ctx.font = '13px sans-serif'; ctx.fillStyle = '#e8e5dc';
      ctx.fillText(S.mission.objective, 30, 130, 282);
    }
    // clock
    panel(ctx, W / 2 - 74, 14, 148, 42);
    txt(ctx, S.clock, W / 2 - 30, 42, 'bold 19px sans-serif', '#f2f0ea', 'center');
    txt(ctx, S.phase, W / 2 + 38, 42, '12px sans-serif', 'rgba(240,238,230,0.75)', 'center');
    // money / stars / rank
    panel(ctx, W - 196, 14, 180, 76);
    txt(ctx, '$' + S.money.toLocaleString('en-US'), W - 30, 44, 'bold 20px sans-serif', '#8fd48a', 'right');
    for (let i = 0; i < 5; i++) star(ctx, W - 158 + i * 21, 68, 8, i < S.stars);
    if (S.stars > 0) bar(ctx, W - 182, 82, 152, 4, S.bust, '#c9403a');
    txt(ctx, S.rankName + ' · ' + S.rp + ' RP', W - 30, 106, '11.5px sans-serif', 'rgba(240,238,230,0.75)', 'right');
    // health / armour — top-left corner, always visible at a glance
    panel(ctx, 16, 16, 190, 56);
    txt(ctx, 'HP', 28, 42, 'bold 10.5px sans-serif', 'rgba(240,238,230,0.7)');
    bar(ctx, 52, 34, 140, 8, S.hp, '#7db85c');
    txt(ctx, 'AR', 28, 60, 'bold 10.5px sans-serif', 'rgba(240,238,230,0.7)');
    bar(ctx, 52, 52, 140, 8, S.ar, '#5c8ab8');
    if (S.crew) {
      panel(ctx, 16, 156, 262, 30);
      txt(ctx, S.crew, 28, 176, '12px sans-serif', '#e8e5dc');
    }
    // weapon card with drawn profile
    panel(ctx, W - 216, H - 118, 200, 102);
    ctx.save(); ctx.translate(W - 204, H - 108); drawWeaponProfile(ctx, S.weapon, 176); ctx.restore();
    txt(ctx, WEAPON_INFO[S.weapon].name, W - 30, H - 40, 'bold 13.5px sans-serif', '#f2f0ea', 'right');
    txt(ctx, S.weapon === 'fists' ? '—' : `${S.ammo} / ${S.reserve}`, W - 30, H - 24, '12.5px sans-serif', 'rgba(240,238,230,0.75)', 'right');
    txt(ctx, 'slot ' + (WEAPON_ORDER.indexOf(S.weapon) + 1) + ' / 5 · TAB wheel', W - 204, H - 24, '10.5px sans-serif', 'rgba(240,238,230,0.55)');
    // dialogue
    if (S.dialogue) {
      const w = Math.min(560, W - 360), x = (W - w) / 2;
      panel(ctx, x, H - 96, w, 62);
      txt(ctx, S.dialogue.who, x + 18, H - 70, 'bold 12.5px sans-serif', MAGENTA);
      ctx.font = '14.5px sans-serif'; ctx.fillStyle = '#f0ede4';
      ctx.fillText(S.dialogue.line, x + 18, H - 48, w - 36);
    }
    // driving speedo
    if (S.driving) {
      panel(ctx, W - 216, H - 240, 200, 108);
      txt(ctx, Math.round(S.speed) + '', W - 116, H - 176, 'bold 40px sans-serif', '#f2f0ea', 'center');
      txt(ctx, 'km/h · ' + S.driving, W - 116, H - 156, '11.5px sans-serif', 'rgba(240,238,230,0.75)', 'center');
      txt(ctx, 'damage', W - 204, H - 146, '10px sans-serif', 'rgba(240,238,230,0.6)');
      bar(ctx, W - 160, H - 152, 130, 6, 1 - S.damage, S.damage > 0.6 ? '#c9403a' : '#7db85c');
      txt(ctx, S.radio, W - 116, H - 240 + 122, '11px sans-serif', '#9fd4c0', 'center');
    }
    if (S.prompt) {
      panel(ctx, W / 2 - 150, H - 150, 300, 34);
      txt(ctx, S.prompt, W / 2, H - 128, '13px sans-serif', '#f2f0ea', 'center');
    }
    if (S.toast) {
      const w = ctx.measureText(S.toast).width + 44;
      panel(ctx, W / 2 - w / 2, 70, Math.max(w, 240), 36);
      txt(ctx, S.toast, W / 2, 93, 'bold 13.5px sans-serif', '#ffd489', 'center');
    }
    if (S.crosshair) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, 7); ctx.stroke();
    }
    this.drawMinimap(S);
  }

  drawWheel(S) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.fillStyle = 'rgba(8,8,12,0.15)'; ctx.fillRect(0, 0, W, H); // light veil only: the world behind the wheel stays clearly lit
    const cx = W / 2, cy = H / 2, R0 = 92, R1 = 238;
    WEAPON_ORDER.forEach((kind, i) => {
      const a0 = -Math.PI / 2 + (i - 0.42) * (Math.PI * 2 / 5), a1 = -Math.PI / 2 + (i + 0.42) * (Math.PI * 2 / 5);
      const sel = S.wheelSel === i;
      ctx.beginPath();
      ctx.arc(cx, cy, R1, a0, a1); ctx.arc(cx, cy, R0, a1, a0, true); ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, R0, cx, cy, R1);
      g.addColorStop(0, sel ? 'rgba(142,36,85,0.92)' : 'rgba(30,34,42,0.88)');
      g.addColorStop(1, sel ? 'rgba(95,23,57,0.92)' : 'rgba(16,19,25,0.88)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = sel ? MAGENTA : PANEL_EDGE; ctx.lineWidth = sel ? 2.4 : 1; ctx.stroke();
      const am = (a0 + a1) / 2, mx = cx + Math.cos(am) * (R0 + R1) / 2, my = cy + Math.sin(am) * (R0 + R1) / 2;
      ctx.save(); ctx.translate(mx - 56, my - 34); drawWeaponProfile(ctx, kind, 112); ctx.restore();
      const info = WEAPON_INFO[kind];
      txt(ctx, info.name, mx, my + 26, 'bold 11.5px sans-serif', '#f2f0ea', 'center');
      const ammo = kind === 'fists' ? '∞' : `${S.ammoOf[kind]} / ${S.reserveOf[kind]}`;
      txt(ctx, ammo, mx, my + 41, '10.5px sans-serif', 'rgba(240,238,230,0.7)', 'center');
      // segmented stat bars
      const stats = [['DMG', info.dmg], ['RATE', info.rate], ['RNG', info.range]];
      stats.forEach(([label, v], si) => {
        const bx = mx - 40, by = my + 48 + si * 9;
        txt(ctx, label, bx - 4, by + 7, '8.5px sans-serif', 'rgba(240,238,230,0.6)', 'right');
        for (let sgm = 0; sgm < 10; sgm++) {
          ctx.fillStyle = sgm < v ? (sel ? '#ffd489' : '#9fb6c9') : 'rgba(255,255,255,0.14)';
          ctx.fillRect(bx + sgm * 8.4, by, 6.4, 5);
        }
      });
    });
    txt(ctx, 'WEAPON WHEEL', cx, cy + 5, 'bold 15px sans-serif', '#f2f0ea', 'center');
    txt(ctx, window.__palmeraTouch ? 'tap a weapon to select · tap the centre to close' : 'click or 1-5 to select · Tab to close', cx, cy + 24, '11.5px sans-serif', 'rgba(240,238,230,0.65)', 'center');
  }

  drawPause(S) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.fillStyle = 'rgba(6,7,10,0.78)'; ctx.fillRect(0, 0, W, H);
    this.buttons = [];
    txt(ctx, 'PALMERA HEAT IV', 48, 58, 'bold 26px sans-serif', '#f5efe2');
    const tabs = ['MAP', 'STORY', 'STATS', 'CONTROLS'];
    tabs.forEach((t, i) => this.button('tab:' + t, 48 + i * 128, 76, 116, 36, t, S.tab === t));
    const top = 132;
    if (S.tab === 'MAP') {
      const size = Math.min(H - top - 90, 560);
      const m = drawMapBase(ctx, 48, top, size, true);
      this.mapRect = { x: 48, y: top, size, scale: m.scale };
      const P = (wx, wz) => [m.px(wx), m.pz(wz)];
      { const [a, b] = P(WORLD.hq.x, WORLD.hq.z); drawHeel(ctx, a, b, 26); txt(ctx, 'PBPD HQ', a, b + 26, 'bold 11px sans-serif', '#ff8fc0', 'center'); }
      { const [a, b] = P(WORLD.ghost.x, WORLD.ghost.z); marker(ctx, a, b, 'G', '#c23a7d'); }
      { const [a, b] = P(WORLD.garage.x, WORLD.garage.z); marker(ctx, a, b, 'H', '#3f7d5a'); }
      { const [a, b] = P(WORLD.sahurSpot.x, WORLD.sahurSpot.z); marker(ctx, a, b, 'S', '#8a6a3a'); }
      { const [a, b] = P(S.player.x, S.player.z); ctx.beginPath(); ctx.arc(a, b, 5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#111'; ctx.stroke(); }
      if (S.target) { const [a, b] = P(S.target.x, S.target.z); marker(ctx, a, b, '!', '#c9403a'); }
      if (S.waypoint) { const [a, b] = P(S.waypoint.x, S.waypoint.z); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a, b, 9, 0, 7); ctx.stroke(); }
      const lx = 48 + size + 28;
      txt(ctx, 'LEGEND', lx, top + 16, 'bold 14px sans-serif', GOLD);
      const rows = [['G', '#c23a7d', 'Ghost money drop'], ['H', '#3f7d5a', 'Garage (home)'], ['S', '#8a6a3a', 'Sahur summoning stones'], ['!', '#c9403a', 'Mission target']];
      rows.forEach(([l, c, label], i) => { marker(ctx, lx + 10, top + 44 + i * 30, l, c); txt(ctx, label, lx + 26, top + 48 + i * 30, '13px sans-serif', '#e8e5dc'); });
      drawHeel(ctx, lx + 10, top + 44 + 4 * 30, 20);
      txt(ctx, 'PBPD HQ — the shoe building', lx + 26, top + 48 + 4 * 30, '13px sans-serif', '#e8e5dc');
      txt(ctx, 'Click the map to set a waypoint.', lx, top + 44 + 5 * 30 + 16, '12.5px sans-serif', 'rgba(240,238,230,0.65)');
      txt(ctx, 'You are in ' + S.district + ' · ' + S.street, lx, top + 44 + 5 * 30 + 40, '12.5px sans-serif', 'rgba(240,238,230,0.65)');
    } else if (S.tab === 'STORY') {
      txt(ctx, 'THE RENT IS DUE — a story in three acts', 48, top + 14, 'bold 16px sans-serif', GOLD);
      S.jobs.forEach((j, i) => {
        const y = top + 48 + i * 52;
        panel(ctx, 48, y - 20, Math.min(760, W - 96), 44);
        txt(ctx, (j.done ? '✓ ' : j.active ? '▶ ' : '· ') + j.title, 64, y + 2, 'bold 14px sans-serif', j.done ? '#8fd48a' : '#f2f0ea');
        txt(ctx, j.blurb, 64, y + 19, '12px sans-serif', 'rgba(240,238,230,0.65)');
        txt(ctx, j.done ? 'DONE' : j.active ? 'ACTIVE' : 'LOCKED', Math.min(760, W - 96) + 32, y + 2, 'bold 11.5px sans-serif', j.done ? '#8fd48a' : j.active ? GOLD : 'rgba(240,238,230,0.4)', 'right');
      });
    } else if (S.tab === 'STATS') {
      const rows = [
        ['Rank', S.rankName], ['Respect (RP)', S.rp + ''], ['Money', '$' + S.money.toLocaleString('en-US')],
        ['District standing', S.standing + ' / 5'], ['Jobs done', S.jobsDone + ' / 6'],
        ['Cars stolen', S.stats.carsStolen + ''], ['Shots fired', S.stats.shots + ''], ['Bills collected', S.stats.bills + ''],
        ['Distance swum', Math.round(S.stats.swum) + ' m'], ['Times busted', S.stats.busted + ''],
        ['Sahur summoned', S.stats.sahur + ''], ['Play time', S.playtime],
      ];
      rows.forEach(([k, v], i) => {
        const y = top + 30 + i * 34;
        txt(ctx, k, 64, y, '14px sans-serif', 'rgba(240,238,230,0.7)');
        txt(ctx, v, 420, y, 'bold 14.5px sans-serif', '#f2f0ea');
      });
    } else {
      const rows = [
        ['W A S D', 'Move / drive'], ['Mouse', 'Look (click the game to capture)'], ['Shift', 'Sprint'],
        ['Left mouse', 'Fire / punch'], ['Right mouse (hold)', 'Aim'], ['Tab', 'Weapon wheel'], ['1 – 5', 'Weapon slots'],
        ['F', 'Enter / exit car'], ['G', 'Dre decoy (crew ability)'], ['E', 'Talk / interact / summon'],
        ['R', 'Next radio station (in car)'], ['M or Esc', 'Pause / map'], ['Space', 'Jump / climb out of water'],
      ];
      rows.forEach(([k, v], i) => {
        const y = top + 30 + i * 32;
        txt(ctx, k, 64, y, 'bold 13.5px sans-serif', GOLD);
        txt(ctx, v, 240, y, '13.5px sans-serif', '#e8e5dc');
      });
    }
    this.button('resume', W - 190, H - 64, 150, 40, 'RESUME', true);
    this.button('savequit', W - 360, H - 64, 158, 40, 'SAVE + TITLE', false);
  }
}
