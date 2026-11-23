// Detailed 2D side-profile illustrations of the five weapon slots, drawn with
// canvas paths — barrels, stocks, magazines, sights, checkered grips, wood grain
// and shading. Used by the weapon wheel and the HUD weapon card (the only places
// 2D weapon art appears; in the world the weapons are real 3D models).

function shade(ctx, x, y, w, h, base, hi = 'rgba(255,255,255,0.20)', lo = 'rgba(0,0,0,0.35)') {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, hi); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, lo);
  ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
function grip(ctx, x, y, w, h, ang = 0.28) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = '#262019'; ctx.fillRect(-w / 2, 0, w, h);
  ctx.strokeStyle = 'rgba(200,175,140,0.4)'; ctx.lineWidth = 1;
  for (let i = -h; i < h; i += 4) {
    ctx.beginPath(); ctx.moveTo(-w / 2, i); ctx.lineTo(w / 2, i + w); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2, i); ctx.lineTo(-w / 2, i + w); ctx.stroke();
  }
  ctx.restore();
}
function wood(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#8a6844'); g.addColorStop(1, '#5f4527');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(50,32,14,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); const yy = y + 3 + i * (h - 6) / 3;
    ctx.moveTo(x + 2, yy); ctx.bezierCurveTo(x + w * 0.3, yy + 2, x + w * 0.7, yy - 2, x + w - 2, yy); ctx.stroke();
  }
}
const METAL = '#43464d', METAL_D = '#2e3036', LINE = 'rgba(12,12,14,0.85)';

function outline(ctx) { ctx.strokeStyle = LINE; ctx.lineWidth = 1.4; ctx.stroke(); }

/** Draw the profile of `kind` inside a box of width w (height ~w*0.34), origin at top-left. */
export function drawWeaponProfile(ctx, kind, w) {
  const u = w / 100; // unit: profile space is 100 x 34
  ctx.save(); ctx.scale(u, u); ctx.lineJoin = 'round';
  if (kind === 'fists') {
    ctx.fillStyle = '#c89878';
    ctx.beginPath(); // a clenched fist, knuckles up
    ctx.moveTo(30, 26); ctx.bezierCurveTo(24, 26, 22, 18, 26, 13);
    ctx.bezierCurveTo(27, 8, 33, 7, 36, 10); ctx.bezierCurveTo(38, 6, 44, 6, 45, 10);
    ctx.bezierCurveTo(47, 6, 53, 7, 53, 11); ctx.bezierCurveTo(56, 8, 61, 10, 60, 15);
    ctx.bezierCurveTo(64, 18, 62, 24, 57, 26); ctx.bezierCurveTo(50, 29, 38, 29, 30, 26);
    ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke();
    ctx.strokeStyle = 'rgba(90,50,25,0.6)'; ctx.lineWidth = 1.2;
    for (const fx of [36, 45, 53]) { ctx.beginPath(); ctx.moveTo(fx, 11); ctx.lineTo(fx, 16); ctx.stroke(); }
    ctx.fillStyle = '#a9744f'; ctx.fillRect(40, 26, 14, 6); // wrist
  } else if (kind === 'pistol') {
    shade(ctx, 22, 8, 52, 7, METAL); outline(ctx); // slide
    ctx.fillStyle = METAL_D; ctx.fillRect(70, 9.5, 7, 4); // muzzle
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(27, 5.5, 2.4, 2.6); ctx.fillRect(66, 5.5, 2.4, 2.6); // sights
    ctx.fillStyle = METAL; ctx.fillRect(24, 15, 46, 5); // frame
    ctx.strokeStyle = LINE; ctx.beginPath(); ctx.arc(52, 21, 3.6, 0, 7); ctx.stroke(); // trigger guard
    grip(ctx, 31, 17, 9, 15, 0.24);
    ctx.fillStyle = METAL_D; ctx.fillRect(27.5, 31, 10, 2.4); // mag base
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = 'bold 3.4px sans-serif'; ctx.fillText('PALMERA ARMS', 40, 12.6);
  } else if (kind === 'smg') {
    shade(ctx, 26, 9, 40, 9, METAL); outline(ctx); // receiver
    ctx.fillStyle = '#33302c'; ctx.fillRect(62, 10.5, 15, 6); // handguard
    ctx.fillStyle = METAL_D; ctx.fillRect(77, 11, 9, 5); // suppressor
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; for (const rx of [79, 82]) { ctx.beginPath(); ctx.moveTo(rx, 11); ctx.lineTo(rx, 16); ctx.stroke(); }
    ctx.fillStyle = METAL; ctx.fillRect(14, 10, 12, 4.6); ctx.fillRect(12, 9, 4, 7); // folding stock
    ctx.fillStyle = METAL_D; ctx.fillRect(42, 18, 6, 13); // straight mag
    grip(ctx, 31, 17, 8, 12, 0.3);
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(34, 6.4, 2.2, 2.6); ctx.fillRect(56, 6.4, 2.2, 2.6);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 3.2px sans-serif'; ctx.fillText('COCO-9', 44, 15);
  } else if (kind === 'shotgun') {
    wood(ctx, 6, 12, 22, 9); ctx.strokeStyle = LINE; ctx.strokeRect(6, 12, 22, 9); // wooden stock
    shade(ctx, 28, 10, 24, 8, METAL); outline(ctx); // receiver
    ctx.fillStyle = '#191a1c'; ctx.fillRect(50, 9.6, 44, 3.4); // barrel
    ctx.fillStyle = '#26262a'; ctx.fillRect(52, 13.6, 36, 2.8); // magazine tube
    wood(ctx, 56, 15.5, 17, 6.5); ctx.strokeStyle = LINE; ctx.strokeRect(56, 15.5, 17, 6.5); // pump grip
    ctx.fillStyle = '#e8c86a'; ctx.fillRect(91, 7.6, 2.4, 2.4); // bead sight
    grip(ctx, 33, 17, 8, 11, 0.3);
    for (let i = 0; i < 4; i++) { // shell carrier: brass shells on the receiver
      ctx.fillStyle = '#c9a44a'; ctx.fillRect(31 + i * 4.6, 19.5, 3.4, 5.6);
      ctx.fillStyle = '#8c2f26'; ctx.fillRect(31 + i * 4.6, 19.5, 3.4, 1.8);
    }
    ctx.fillStyle = 'rgba(240,230,200,0.85)'; ctx.font = 'bold 3.6px sans-serif'; ctx.fillText('PALMERA ARMS', 30, 15.4);
    ctx.strokeStyle = 'rgba(20,16,10,0.6)'; ctx.beginPath(); ctx.moveTo(14, 21); ctx.quadraticCurveTo(40, 30, 66, 24); ctx.stroke(); // sling hint
  } else if (kind === 'rifle') {
    ctx.fillStyle = '#33302c'; ctx.fillRect(6, 12.5, 16, 7); // stock
    shade(ctx, 22, 10, 36, 9, METAL); outline(ctx); // receiver
    ctx.fillStyle = '#33302c'; ctx.fillRect(56, 11.5, 17, 6); // handguard
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; for (const vx of [59, 63, 67]) { ctx.beginPath(); ctx.moveTo(vx, 11.5); ctx.lineTo(vx, 17.5); ctx.stroke(); } // vents
    ctx.fillStyle = '#191a1c'; ctx.fillRect(73, 12.6, 15, 3); // barrel
    ctx.fillStyle = METAL_D; ctx.fillRect(87, 11.8, 6, 4.6); // muzzle brake
    ctx.fillStyle = METAL; ctx.fillRect(30, 6.8, 22, 3); // carry handle
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(48, 4.8, 2.2, 2.2);
    ctx.save(); ctx.translate(38, 18); ctx.rotate(0.16); ctx.fillStyle = '#232428'; ctx.fillRect(-3.4, 0, 6.8, 14); ctx.restore(); // curved mag
    grip(ctx, 27, 17, 8, 11, 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 3.2px sans-serif'; ctx.fillText('PALMERA ARMS', 24, 15.6);
  }
  ctx.restore();
}

export const WEAPON_INFO = {
  fists: { name: 'FISTS', dmg: 1, rate: 3, range: 1 },
  pistol: { name: 'PISTOL', dmg: 3, rate: 5, range: 5 },
  smg: { name: 'COCO SMG', dmg: 4, rate: 9, range: 6 },
  shotgun: { name: 'BREAKER-12', dmg: 9, rate: 2, range: 3 },
  rifle: { name: 'PALMERA AR-7', dmg: 7, rate: 7, range: 9 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
