// Procedural texture foundry: every surface in Palmera Bay is painted here onto the
// atlas with a seeded brush — asphalt grain and cracks, tiled sidewalks, sand with a
// wet band, sparkling water, four families of building facades with framed windows,
// human faces, shirt cloth, vehicle liveries, shop signs and the big gag banners.
// Colours are kept muted and natural: sun-bleached stucco, grey asphalt, tan sand.
import { rngStream } from './random.js';

function speckle(ctx, R, w, h, n, colors, s0 = 1, s1 = 3) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(R.next() * colors.length)];
    const s = R.range(s0, s1);
    ctx.fillRect(R.range(0, w), R.range(0, h), s, s);
  }
}
function noiseOver(ctx, R, w, h, base, flecks, n = 900) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  speckle(ctx, R, w, h, n, flecks);
}
function textTile(atlas, name, w, h, draw) {
  return atlas.tile(name, w, h, (ctx) => draw(ctx, w, h));
}
function centeredText(ctx, text, x, y, font, color, spacing = 0) {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (!spacing) { ctx.fillText(text, x, y); return; }
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = x - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, cx + widths[i] / 2, y); cx += widths[i] + spacing; });
}

export function buildTextures(atlas) {
  const R = rngStream(1337);
  const T = {};
  const reg = (name, tile) => { T[name] = tile; return tile; };

  // --- utility tiles ---
  reg('white', atlas.tile('white', 8, 8, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 8, 8); }));
  reg('shadow', atlas.tile('shadow', 128, 128, (c) => {
    c.clearRect(0, 0, 128, 128); // atlas starts opaque white: clear first or the alpha falloff is lost
    const g = c.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, 'rgba(10,8,6,0.85)'); g.addColorStop(0.7, 'rgba(10,8,6,0.4)'); g.addColorStop(1, 'rgba(10,8,6,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  }));
  reg('glow', atlas.tile('glow', 128, 128, (c) => {
    c.clearRect(0, 0, 128, 128); // atlas starts opaque white: clear first or the alpha falloff is lost
    const g = c.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  }));
  reg('moon', atlas.tile('moon', 128, 128, (c) => {
    c.clearRect(0, 0, 128, 128); // transparent corners, or the moon billboard shows as a pale square
    c.fillStyle = '#e8e6da'; c.beginPath(); c.arc(64, 64, 44, 0, 7); c.fill();
    c.fillStyle = 'rgba(160,158,145,0.5)';
    for (const [x, y, r] of [[48, 50, 9], [78, 72, 12], [60, 84, 6], [82, 42, 5], [40, 70, 4]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(120,118,105,0.35)';
    for (const [x, y, r] of [[48, 50, 5], [78, 72, 7], [60, 84, 3]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  }));

  // --- ground surfaces ---
  reg('asphalt', atlas.tile('asphalt', 256, 256, (c) => {
    noiseOver(c, R, 256, 256, '#3d3f42', ['#36383b', '#45484c', '#313336', '#4a4d50'], 1500);
    // tar patches: darker sealed rectangles with feathered edges, plus a
    // couple of faint oil stains — the repairs every real street accumulates
    for (let i = 0; i < 3; i++) {
      const px = R.range(10, 190), py = R.range(10, 190), pw = R.range(34, 62), ph = R.range(22, 44);
      c.fillStyle = 'rgba(24,24,27,0.20)'; c.fillRect(px - 3, py - 3, pw + 6, ph + 6);
      c.fillStyle = 'rgba(28,28,31,0.42)'; c.fillRect(px, py, pw, ph);
      c.strokeStyle = 'rgba(12,12,14,0.5)'; c.lineWidth = 1; c.strokeRect(px, py, pw, ph);
    }
    for (let i = 0; i < 2; i++) {
      const ox = R.range(30, 226), oy = R.range(30, 226);
      const og = c.createRadialGradient(ox, oy, 2, ox, oy, R.range(12, 22));
      og.addColorStop(0, 'rgba(12,12,16,0.30)'); og.addColorStop(1, 'rgba(12,12,16,0)');
      c.fillStyle = og; c.fillRect(ox - 24, oy - 24, 48, 48);
    }
    c.strokeStyle = 'rgba(20,20,22,0.5)'; c.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) { // cracks
      c.beginPath(); let x = R.range(0, 256), y = R.range(0, 256); c.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += R.range(-26, 26); y += R.range(-26, 26); c.lineTo(x, y); }
      c.stroke();
    }
    speckle(c, R, 256, 256, 260, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.16)'], 1, 2);
  }));
  reg('roadLine', atlas.tile('roadLine', 128, 256, (c) => {
    noiseOver(c, R, 128, 256, '#3d3f42', ['#36383b', '#45484c', '#313336'], 700);
    c.fillStyle = 'rgba(216,190,90,0.85)';
    c.fillRect(60, 12, 8, 96); c.fillRect(60, 148, 8, 96); // worn centre dashes
    speckle(c, R, 128, 256, 200, ['rgba(0,0,0,0.2)'], 1, 3);
  }));
  reg('sidewalk', atlas.tile('sidewalk', 256, 256, (c) => {
    noiseOver(c, R, 256, 256, '#8f8c85', ['#86837d', '#98958e', '#7c7a74'], 800);
    c.strokeStyle = 'rgba(60,58,54,0.55)'; c.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, 256); c.stroke(); c.beginPath(); c.moveTo(0, i * 64); c.lineTo(256, i * 64); c.stroke(); }
  }));
  reg('concrete', atlas.tile('concrete', 256, 256, (c) => {
    noiseOver(c, R, 256, 256, '#7e7c76', ['#76746e', '#888680', '#6e6c66'], 700);
    c.fillStyle = 'rgba(50,50,48,0.18)';
    for (let i = 0; i < 7; i++) c.fillRect(R.range(0, 230), R.range(0, 230), R.range(8, 26), R.range(4, 10));
  }));
  reg('sand', atlas.tile('sand', 256, 256, (c) => {
    noiseOver(c, R, 256, 256, '#c9ad7e', ['#bfa676', '#d3b98a', '#c2a273', '#d8c294'], 1600);
    // wind ripples: soft diagonal light/dark bands raked across the beach,
    // the corduroy pattern real sand takes under an onshore breeze
    c.save(); c.translate(128, 128); c.rotate(-0.42); c.translate(-128, -128);
    for (let y = -64; y < 330; y += 15) {
      c.fillStyle = 'rgba(255,240,205,0.23)'; c.fillRect(-80, y, 420, 5);
      c.fillStyle = 'rgba(120,95,55,0.21)'; c.fillRect(-80, y + 7, 420, 4);
    }
    c.restore();
    // coarse grain: short dark strokes so the surface keeps visible texture
    // even where a whole tile spans 55 m of beach
    c.strokeStyle = 'rgba(110,88,50,0.35)'; c.lineWidth = 1.2;
    for (let i = 0; i < 240; i++) { const x = R.range(0, 254), y = R.range(0, 254); c.beginPath(); c.moveTo(x, y); c.lineTo(x + R.range(2, 5), y + R.range(-1, 1)); c.stroke(); }
    // broad soft patches — damp hollows and wind-scoured pans — so the beach
    // has large-scale variation and never reads as one flat colour
    for (let i = 0; i < 5; i++) {
      const px = R.range(20, 236), py = R.range(20, 236), pr = R.range(18, 42);
      const pg = c.createRadialGradient(px, py, 2, px, py, pr);
      const dark = i % 2 === 0;
      pg.addColorStop(0, dark ? 'rgba(120,95,55,0.16)' : 'rgba(255,242,210,0.14)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = pg; c.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
    // shell flecks and tiny pebbles scattered through the dry sand
    speckle(c, R, 256, 256, 150, ['rgba(250,244,228,0.5)', 'rgba(214,196,160,0.55)', 'rgba(140,116,80,0.4)'], 1, 2);
  }));
  reg('sandWet', atlas.tile('sandWet', 256, 256, (c) => {
    noiseOver(c, R, 256, 256, '#a98f63', ['#9d8459', '#b3986c', '#8f7a52'], 1300);
    speckle(c, R, 256, 256, 120, ['rgba(255,255,255,0.13)'], 1, 2);
  }));
  reg('foam', atlas.tile('foam', 256, 64, (c) => {
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = 'rgba(240,246,244,0.9)';
    for (let i = 0; i < 90; i++) { c.beginPath(); c.arc(R.range(0, 256), R.range(6, 58), R.range(2, 7), 0, 7); c.fill(); }
    c.fillStyle = 'rgba(240,246,244,0.55)'; c.fillRect(0, 26, 256, 5);
  }));
  reg('grass', atlas.tile('grass', 256, 256, (c) => {
    noiseOver(c, R, 256, 256, '#5d7040', ['#54663a', '#677a47', '#4d5f35', '#71824c'], 1700);
    c.strokeStyle = 'rgba(40,52,26,0.5)';
    for (let i = 0; i < 130; i++) { const x = R.range(0, 256), y = R.range(0, 256); c.beginPath(); c.moveTo(x, y); c.lineTo(x + R.range(-2, 2), y - R.range(3, 7)); c.stroke(); }
  }));
  reg('roof', atlas.tile('roof', 256, 256, (c) => {
    noiseOver(c, R, 256, 256, '#5c564e', ['#544e46', '#655e55', '#4c463f'], 1200);
  }));
  reg('planks', atlas.tile('planks', 256, 256, (c) => {
    c.fillStyle = '#8a6f4d'; c.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      c.fillStyle = `rgb(${132 + R.int(-12, 12)},${104 + R.int(-10, 10)},${72 + R.int(-8, 8)})`;
      c.fillRect(0, y, 256, 30);
      c.strokeStyle = 'rgba(70,52,30,0.6)';
      for (let s = 0; s < 12; s++) { c.beginPath(); const yy = y + R.range(3, 29); c.moveTo(0, yy); c.bezierCurveTo(80, yy + 2, 170, yy - 2, 256, yy); c.stroke(); }
      c.fillStyle = 'rgba(40,30,16,0.8)'; c.fillRect(0, y + 30, 256, 2);
      c.beginPath(); c.arc(14, y + 15, 2.4, 0, 7); c.arc(242, y + 15, 2.4, 0, 7); c.fill();
    }
  }));
  reg('corrugated', atlas.tile('corrugated', 256, 256, (c) => {
    c.fillStyle = '#77807f'; c.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      const g = c.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, '#5f6867'); g.addColorStop(0.5, '#8b9492'); g.addColorStop(1, '#5a6362');
      c.fillStyle = g; c.fillRect(x, 0, 16, 256);
    }
    speckle(c, R, 256, 256, 300, ['rgba(90,60,30,0.25)', 'rgba(0,0,0,0.15)'], 1, 4);
  }));
  reg('water', atlas.tile('water', 256, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#27586b'); g.addColorStop(1, '#1d4256');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 240; i++) { // sparkle streaks
      c.fillStyle = `rgba(200,230,235,${R.range(0.04, 0.2)})`;
      c.fillRect(R.range(0, 250), R.range(0, 256), R.range(4, 18), 1.4);
    }
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(10,30,40,${R.range(0.05, 0.16)})`;
      c.fillRect(R.range(0, 250), R.range(0, 256), R.range(6, 22), 2);
    }
  }));
  reg('wood', atlas.tile('wood', 256, 256, (c) => {
    c.fillStyle = '#7d5f39'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 46; i++) {
      c.strokeStyle = `rgba(${60 + R.int(0, 30)},${42 + R.int(0, 20)},20,${R.range(0.25, 0.6)})`;
      c.lineWidth = R.range(1, 3);
      c.beginPath(); const y = R.range(0, 256); c.moveTo(0, y);
      c.bezierCurveTo(70, y + R.range(-6, 6), 180, y + R.range(-6, 6), 256, y); c.stroke();
    }
    for (let i = 0; i < 5; i++) { const x = R.range(30, 226), y = R.range(30, 226); c.strokeStyle = 'rgba(50,34,14,0.7)'; c.beginPath(); c.arc(x, y, R.range(4, 9), 0, 7); c.stroke(); }
  }));
  reg('bark', atlas.tile('bark', 128, 256, (c) => {
    noiseOver(c, R, 128, 256, '#6d5136', ['#5f4630', '#7a5c3e', '#54402c'], 500);
    c.strokeStyle = 'rgba(40,28,16,0.6)';
    for (let i = 0; i < 26; i++) { c.beginPath(); const x = R.range(0, 128); c.moveTo(x, 0); c.lineTo(x + R.range(-9, 9), 256); c.stroke(); }
  }));
  reg('frond', atlas.tile('frond', 128, 256, (c) => {
    c.clearRect(0, 0, 128, 256);
    // a solid leaf silhouette first (deep green) so the blade reads as lush
    // foliage at any distance, then the spine + leaflet strokes over it
    c.fillStyle = '#2f5a28';
    c.beginPath();
    c.moveTo(64, 254);
    c.bezierCurveTo(20, 200, 12, 130, 30, 66);
    c.bezierCurveTo(40, 30, 52, 10, 64, 2);
    c.bezierCurveTo(76, 10, 88, 30, 98, 66);
    c.bezierCurveTo(116, 130, 108, 200, 64, 254);
    c.fill();
    c.strokeStyle = '#24451e'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(64, 256); c.quadraticCurveTo(58, 130, 64, 6); c.stroke();
    c.lineWidth = 3.2;
    for (let i = 0; i < 22; i++) {
      const t = i / 22, y = 250 - t * 235, spread = 10 + t * 40, droop = 14 + t * 26;
      c.strokeStyle = `rgb(${58 + i * 2},${108 + i},${48})`;
      c.beginPath(); c.moveTo(63, y); c.quadraticCurveTo(63 - spread * 0.6, y - 8, 63 - spread, y + droop); c.stroke();
      c.beginPath(); c.moveTo(65, y); c.quadraticCurveTo(65 + spread * 0.6, y - 8, 65 + spread, y + droop); c.stroke();
    }
  }));

  // --- building facades: 4 styles x 2 variants; windows framed + mullioned ---
  const facadePaint = (style) => (c, w, h) => {
    const bases = { stucco: ['#cbb79b', '#bfae94'], brick: ['#8d5f4a', '#7e5541'], concrete: ['#9a978f', '#8b8880'], glass: ['#5d707c', '#54666f'] };
    noiseOver(c, R, w, h, bases[style][0], [bases[style][1], 'rgba(0,0,0,0.08)', 'rgba(255,255,255,0.06)'], 500);
    if (style === 'brick') {
      c.fillStyle = 'rgba(60,35,25,0.35)';
      for (let y = 6; y < h; y += 10) for (let x = ((y / 10) % 2) * 14; x < w; x += 28) c.fillRect(x, y, 24, 2.4);
    }
    if (style === 'glass') { c.fillStyle = 'rgba(200,225,235,0.10)'; c.fillRect(0, 0, w, h); }
    const cols = 3, rows = 4, ww = 44, wh = 52, gx = (w - cols * ww) / (cols + 1), gy = (h - rows * wh) / (rows + 1);
    for (let rI = 0; rI < rows; rI++) for (let cI = 0; cI < cols; cI++) {
      const x = gx + cI * (ww + gx), y = gy + rI * (wh + gy);
      const lit = R.chance(0.34), warm = R.chance(0.7);
      c.fillStyle = '#3a3f45'; c.fillRect(x - 3, y - 3, ww + 6, wh + 6); // frame
      const g = c.createLinearGradient(x, y, x, y + wh);
      if (style === 'glass') { g.addColorStop(0, '#a8c4cf'); g.addColorStop(1, '#5d7684'); }
      else if (lit) { g.addColorStop(0, warm ? '#ffd489' : '#cfe4f2'); g.addColorStop(1, warm ? '#e8a94e' : '#8fb2c9'); }
      else { g.addColorStop(0, '#4b5a63'); g.addColorStop(1, '#2c363d'); }
      c.fillStyle = g; c.fillRect(x, y, ww, wh);
      c.fillStyle = 'rgba(30,34,38,0.85)'; c.fillRect(x + ww / 2 - 1.5, y, 3, wh); c.fillRect(x, y + wh / 2 - 1.5, ww, 3);
      c.fillStyle = 'rgba(255,255,255,0.20)'; c.beginPath(); c.moveTo(x + 6, y + wh); c.lineTo(x + 20, y); c.lineTo(x + 30, y); c.lineTo(x + 16, y + wh); c.fill();
      if (R.chance(0.3)) { c.fillStyle = 'rgba(226,220,205,0.75)'; c.fillRect(x + 3, y + 3, ww - 6, 12); } // curtain band
      c.fillStyle = 'rgba(0,0,0,0.20)'; c.fillRect(x - 3, y + wh + 3, ww + 6, 4); // sill shadow
    }
    const grad = c.createLinearGradient(0, h - 26, 0, h); // ground-floor grime / AO
    grad.addColorStop(0, 'rgba(30,26,20,0)'); grad.addColorStop(1, 'rgba(30,26,20,0.35)');
    c.fillStyle = grad; c.fillRect(0, h - 26, w, 26);
  };
  for (const style of ['stucco', 'brick', 'concrete', 'glass'])
    for (let v = 0; v < 2; v++) reg(`facade_${style}${v}`, atlas.tile(`facade_${style}${v}`, 256, 256, facadePaint(style)));

  reg('shopfront', atlas.tile('shopfront', 256, 128, (c) => {
    noiseOver(c, R, 256, 128, '#a89a83', ['#9c8e77', 'rgba(0,0,0,0.08)'], 260);
    for (const x of [14, 96, 178]) { // three shop windows + doors
      c.fillStyle = '#2f3a40'; c.fillRect(x, 26, 66, 88);
      const g = c.createLinearGradient(x, 26, x, 114); g.addColorStop(0, '#7d99a6'); g.addColorStop(1, '#41525c');
      c.fillStyle = g; c.fillRect(x + 4, 30, 58, 80);
      c.fillStyle = 'rgba(255,214,130,0.5)'; c.fillRect(x + 8, 66, 50, 30);
      c.fillStyle = '#57493a'; c.fillRect(x + 26, 34, 14, 76);
    }
    c.fillStyle = 'rgba(24,22,20,0.9)'; c.fillRect(0, 0, 256, 16);
  }));
  reg('awning', atlas.tile('awning', 128, 64, (c) => {
    for (let x = 0; x < 128; x += 16) { c.fillStyle = (x / 16) % 2 ? '#e8e2d4' : '#3f6d8e'; c.fillRect(x, 0, 16, 64); }
    c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(0, 52, 128, 12);
  }));
  reg('awningRed', atlas.tile('awningRed', 128, 64, (c) => {
    for (let x = 0; x < 128; x += 16) { c.fillStyle = (x / 16) % 2 ? '#e8e2d4' : '#9c4038'; c.fillRect(x, 0, 16, 64); }
    c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(0, 52, 128, 12);
  }));

  // --- faces & cloth ---
  const SKINS = ['#c89878', '#a9744f', '#8a5a3b', '#e0b08a', '#6f452a'];
  SKINS.forEach((skin, si) => {
    reg(`face${si}`, atlas.tile(`face${si}`, 128, 128, (c) => {
      c.fillStyle = skin; c.fillRect(0, 0, 128, 128);
      const dark = 'rgba(60,35,20,0.55)';
      c.fillStyle = dark; c.fillRect(2, 52, 9, 22); c.fillRect(117, 52, 9, 22); // ears
      c.fillStyle = 'rgba(0,0,0,0.10)'; c.fillRect(0, 100, 128, 28); // jaw shade
      for (const ex of [42, 86]) { // eyes: white, iris, pupil, lid line
        c.fillStyle = '#f2ede6'; c.beginPath(); c.ellipse(ex, 56, 10.5, 6, 0, 0, 7); c.fill();
        c.fillStyle = '#4a3520'; c.beginPath(); c.arc(ex, 56, 4.6, 0, 7); c.fill();
        c.fillStyle = '#14100c'; c.beginPath(); c.arc(ex, 56, 2.2, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(ex - 1.4, 54.4, 1.1, 0, 7); c.fill();
        c.strokeStyle = 'rgba(50,30,16,0.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(ex - 10, 49); c.lineTo(ex + 10, 49); c.stroke();
        c.strokeStyle = 'rgba(40,24,12,0.9)'; c.lineWidth = 3.4; c.beginPath(); // brows
        c.moveTo(ex - 11, 40); c.quadraticCurveTo(ex, 36, ex + 11, 39); c.stroke();
      }
      c.fillStyle = 'rgba(120,70,40,0.35)'; c.beginPath(); c.ellipse(64, 74, 5, 9, 0, 0, 7); c.fill(); // nose
      c.strokeStyle = 'rgba(90,45,25,0.65)'; c.lineWidth = 2; c.beginPath(); c.moveTo(58, 82); c.quadraticCurveTo(64, 85, 70, 82); c.stroke();
      c.strokeStyle = 'rgba(110,55,40,0.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(50, 98); c.quadraticCurveTo(64, 103, 78, 98); c.stroke(); // mouth
      speckle(c, R, 128, 128, 60, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'], 1, 2);
    }));
    reg(`face${si}s`, atlas.tile(`face${si}s`, 128, 128, (c) => { // sunglasses variant
      c.fillStyle = skin; c.fillRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(0,0,0,0.10)'; c.fillRect(0, 100, 128, 28);
      c.fillStyle = '#15181c'; // shades
      c.beginPath(); c.ellipse(42, 56, 14, 9, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(86, 56, 14, 9, 0, 0, 7); c.fill();
      c.fillRect(54, 52, 20, 4); c.fillRect(6, 52, 10, 4); c.fillRect(112, 52, 10, 4);
      c.fillStyle = 'rgba(160,200,220,0.5)'; c.beginPath(); c.ellipse(38, 53, 5, 3, -0.4, 0, 7); c.fill();
      c.fillStyle = 'rgba(120,70,40,0.35)'; c.beginPath(); c.ellipse(64, 74, 5, 9, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(110,55,40,0.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(50, 98); c.quadraticCurveTo(64, 103, 78, 98); c.stroke();
    }));
    reg(`skin${si}`, atlas.tile(`skin${si}`, 32, 32, (c) => { c.fillStyle = skin; c.fillRect(0, 0, 32, 32); speckle(c, R, 32, 32, 26, ['rgba(0,0,0,0.06)'], 1, 2); }));
  });
  const cloth = (name, base, painter) => reg(name, atlas.tile(name, 128, 128, (c) => { c.fillStyle = base; c.fillRect(0, 0, 128, 128); painter(c); speckle(c, R, 128, 128, 130, ['rgba(0,0,0,0.07)', 'rgba(255,255,255,0.05)'], 1, 3); }));
  cloth('clothStripe', '#b8b0a0', (c) => { c.fillStyle = 'rgba(70,90,110,0.55)'; for (let y = 8; y < 128; y += 22) c.fillRect(0, y, 128, 7); });
  cloth('clothCheck', '#7d8a99', (c) => { c.fillStyle = 'rgba(240,240,235,0.35)'; for (let i = 0; i < 128; i += 18) { c.fillRect(i, 0, 5, 128); c.fillRect(0, i, 128, 5); } });
  cloth('clothFloral', '#c96f4a', (c) => { for (let i = 0; i < 26; i++) { c.fillStyle = ['#e8b13c', '#e6e0cc', '#7d9b57'][i % 3]; c.beginPath(); c.arc(R.range(8, 120), R.range(8, 120), R.range(3, 6), 0, 7); c.fill(); } });
  cloth('clothPlain', '#a39a89', () => {});
  cloth('clothDenim', '#4d6076', (c) => { c.strokeStyle = 'rgba(230,220,200,0.4)'; for (let i = 0; i < 128; i += 9) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 128, 128); c.stroke(); } });
  cloth('clothDark', '#3c3f45', () => {});
  reg('hairTile', atlas.tile('hairTile', 64, 64, (c) => { noiseOver(c, R, 64, 64, '#2e2119', ['#241a12', '#3a2b1e', '#171008'], 260); }));

  // --- vehicle bits ---
  reg('carGlass', atlas.tile('carGlass', 128, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#93aebb'); g.addColorStop(0.5, '#54656f'); g.addColorStop(1, '#333f47');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.moveTo(14, 128); c.lineTo(52, 0); c.lineTo(72, 0); c.lineTo(34, 128); c.fill();
  }));
  reg('tire', atlas.tile('tire', 64, 64, (c) => {
    c.fillStyle = '#1d1d1f'; c.fillRect(0, 0, 64, 64);
    c.strokeStyle = 'rgba(120,120,124,0.5)';
    for (let i = 0; i < 64; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i - 8, 64); c.stroke(); }
  }));
  reg('hub', atlas.tile('hub', 64, 64, (c) => {
    c.fillStyle = '#26262a'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#8f959a'; c.beginPath(); c.arc(32, 32, 27, 0, 7); c.fill(); // brake disc
    c.fillStyle = '#5d6165'; // drilled holes in the disc
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.beginPath(); c.arc(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20, 2.2, 0, 7); c.fill(); }
    c.fillStyle = '#b03a30'; c.fillRect(45, 25, 7, 13); // brake caliper behind the spokes
    c.fillStyle = '#2c2e31'; c.beginPath(); c.arc(32, 32, 24, 0, 7); c.fill(); // rim barrel
    c.fillStyle = '#b9bfc4'; // five tapered spokes
    for (let i = 0; i < 5; i++) { c.save(); c.translate(32, 32); c.rotate(i / 5 * Math.PI * 2 - Math.PI / 2); c.fillRect(-3.4, -23, 6.8, 17); c.restore(); }
    c.beginPath(); c.arc(32, 32, 7.5, 0, 7); c.fill();
    c.fillStyle = '#3a3d40'; c.beginPath(); c.arc(32, 32, 3.4, 0, 7); c.fill(); // hub nut
  }));
  const plate = (name, text) => reg(name, textTile(atlas, name, 128, 32, (c) => {
    c.fillStyle = '#e8e6da'; c.fillRect(0, 0, 128, 32); c.strokeStyle = '#31517d'; c.lineWidth = 3; c.strokeRect(2, 2, 124, 28);
    centeredText(c, text, 64, 17, 'bold 19px monospace', '#1c2c47');
  }));
  plate('plate1', 'PLM-2481'); plate('plate2', 'PB-77-KR'); plate('plate3', 'PLM-9034');
  reg('taxiSign', textTile(atlas, 'taxiSign', 128, 48, (c) => {
    c.fillStyle = '#f2b63c'; c.fillRect(0, 0, 128, 48); c.strokeStyle = '#26221a'; c.lineWidth = 4; c.strokeRect(2, 2, 124, 44);
    centeredText(c, 'TAXI', 64, 25, 'bold 26px sans-serif', '#26221a');
  }));
  reg('pbpdSide', textTile(atlas, 'pbpdSide', 256, 64, (c) => {
    c.fillStyle = '#e9ebee'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#1d3d66'; c.fillRect(0, 40, 256, 24);
    centeredText(c, 'PBPD', 128, 21, 'bold 30px sans-serif', '#1d3d66', 6);
    centeredText(c, 'PALMERA BAY POLICE', 128, 52, 'bold 13px sans-serif', '#e9ebee', 2);
  }));
  reg('roundel', atlas.tile('roundel', 128, 128, (c) => {
    c.fillStyle = '#ece7da'; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill();
    c.strokeStyle = '#a33327'; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 54, 0, 7); c.stroke();
    centeredText(c, '7', 64, 68, 'bold 64px sans-serif', '#26303a');
  }));
  reg('bill', atlas.tile('bill', 128, 64, (c) => {
    c.fillStyle = '#7d9b6a'; c.fillRect(0, 0, 128, 64);
    c.strokeStyle = '#4c6b3e'; c.lineWidth = 3; c.strokeRect(4, 4, 120, 56);
    c.fillStyle = '#5d7f4e'; c.beginPath(); c.ellipse(64, 32, 17, 13, 0, 0, 7); c.fill();
    c.fillStyle = '#47663a'; c.beginPath(); c.arc(64, 29, 6, 0, 7); c.fill(); c.fillRect(57, 35, 14, 7);
    centeredText(c, '$', 16, 32, 'bold 20px serif', '#3c5a30'); centeredText(c, '$', 112, 32, 'bold 20px serif', '#3c5a30');
    centeredText(c, '100', 64, 55, 'bold 11px serif', '#3c5a30');
  }));
  reg('starCoin', atlas.tile('starCoin', 128, 128, (c) => {
    c.clearRect(0, 0, 128, 128);
    c.fillStyle = '#e83e8c';
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 24 : 52; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath(); c.fill();
    c.fillStyle = '#f76fb1'; c.beginPath(); c.arc(64, 64, 17, 0, 7); c.fill();
  }));

  // --- weapon materials ---
  reg('gunMetal', atlas.tile('gunMetal', 128, 128, (c) => {
    noiseOver(c, R, 128, 128, '#3a3d42', ['#33363b', '#43464c', '#2c2e33'], 420);
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(0, 10, 128, 5);
  }));
  reg('gunGrip', atlas.tile('gunGrip', 64, 64, (c) => {
    c.fillStyle = '#24211d'; c.fillRect(0, 0, 64, 64);
    c.strokeStyle = 'rgba(190,170,140,0.35)'; c.lineWidth = 1.6;
    for (let i = -64; i < 128; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 64, 64); c.stroke(); c.beginPath(); c.moveTo(i + 64, 0); c.lineTo(i, 64); c.stroke(); }
  }));
  reg('brass', atlas.tile('brass', 32, 32, (c) => { const g = c.createLinearGradient(0, 0, 32, 0); g.addColorStop(0, '#8a6a2c'); g.addColorStop(0.5, '#d9b45c'); g.addColorStop(1, '#8a6a2c'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); }));

  // --- signs & banners (wide tiles) ---
  const sign = (name, w, h, bg, fg, text, font, border) => reg(name, textTile(atlas, name, w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (border) { c.strokeStyle = border; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8); }
    centeredText(c, text, w / 2, h / 2 + 2, font, fg);
  }));
  sign('signHotel', 512, 96, '#27313a', '#f5c86e', 'HOTEL COCO', 'bold 56px sans-serif');
  sign('signCocoFm', 512, 96, '#3a2438', '#f76fb1', 'COCO FM 101.1', 'bold 52px sans-serif');
  sign('signTaco', 512, 96, '#402a1c', '#f2a63c', 'TACO MAR', 'bold 56px sans-serif');
  sign('signGym', 512, 96, '#22262b', '#d8dde2', 'MUSCLE SANDS GYM', 'bold 46px sans-serif');
  sign('signPalmera', 1024, 128, '#00000000', '#f3ead8', 'PALMERA', 'bold 104px sans-serif');
  sign('signGarage', 512, 96, '#2c3436', '#9fd4c0', 'PALMERA GARAGE', 'bold 48px sans-serif');
  sign('signObservatory', 512, 96, '#232c3a', '#bcd2ea', 'OBSERVATORY', 'bold 50px sans-serif');
  reg('bannerGhost', textTile(atlas, 'bannerGhost', 1024, 96, (c) => {
    c.fillStyle = '#20242c'; c.fillRect(0, 0, 1024, 96);
    c.strokeStyle = '#e83e8c'; c.lineWidth = 5; c.strokeRect(5, 5, 1014, 86);
    centeredText(c, 'MAKE.FUN DAILY DROP', 512, 50, 'bold 58px sans-serif', '#f5f2ea', 4);
    c.fillStyle = '#e83e8c'; c.beginPath(); c.arc(52, 48, 16, 0, 7); c.fill(); c.beginPath(); c.arc(972, 48, 16, 0, 7); c.fill();
  }));
  reg('bannerNiceTry', textTile(atlas, 'bannerNiceTry', 1024, 160, (c) => {
    c.fillStyle = '#e9e5da'; c.fillRect(0, 0, 1024, 160);
    c.fillStyle = 'rgba(120,40,30,0.16)'; c.fillRect(0, 0, 1024, 14); c.fillRect(0, 146, 1024, 14);
    centeredText(c, 'NICE TRY BRO', 512, 84, 'bold 104px sans-serif', '#1d3d66', 6);
  }));
  sign('signPBPD', 1024, 96, '#1d3d66', '#e9ebee', 'PALMERA BAY POLICE DEPARTMENT', 'bold 52px sans-serif');
  sign('signHQ', 512, 80, '#e9ebee', '#1d3d66', 'PBPD — HEADQUARTERS', 'bold 40px sans-serif');
  reg('signStiletto', textTile(atlas, 'signStiletto', 512, 96, (c) => {
    c.fillStyle = '#1c1420'; c.fillRect(0, 0, 512, 96);
    for (let x = 10; x < 512; x += 24) for (const y of [8, 88]) { c.fillStyle = '#ffd489'; c.beginPath(); c.arc(x, y, 3.4, 0, 7); c.fill(); }
    centeredText(c, 'STILETTO', 256, 50, 'bold 58px sans-serif', '#ff5fa8', 10);
  }));
  reg('heelSign', atlas.tile('heelSign', 256, 256, (c) => {
    c.clearRect(0, 0, 256, 256);
    // original stiletto silhouette, neon pink with a hot core
    const heel = (ctx) => {
      ctx.beginPath();
      ctx.moveTo(38, 66); ctx.bezierCurveTo(90, 52, 128, 66, 158, 96);   // toe box top
      ctx.bezierCurveTo(178, 116, 196, 128, 218, 130);                    // to the heel tip area
      ctx.lineTo(226, 130); ctx.lineTo(222, 196); ctx.lineTo(206, 196);   // stiletto heel
      ctx.bezierCurveTo(202, 158, 196, 146, 178, 140);
      ctx.bezierCurveTo(140, 128, 96, 128, 62, 112);                      // arch underside
      ctx.bezierCurveTo(44, 104, 34, 88, 38, 66);
      ctx.closePath();
    };
    c.lineJoin = 'round';
    for (const [wdt, col] of [[17, 'rgba(255,47,150,0.30)'], [10, 'rgba(255,47,150,0.65)'], [5, '#ff8fc0']]) {
      c.strokeStyle = col; c.lineWidth = wdt; heel(c); c.stroke();
    }
    c.fillStyle = 'rgba(255,47,150,0.16)'; heel(c); c.fill();
    c.strokeStyle = '#e8b13c'; c.lineWidth = 6; // gold ankle strap
    c.beginPath(); c.moveTo(52, 58); c.quadraticCurveTo(84, 40, 118, 52); c.stroke();
    c.fillStyle = '#ffe9a8'; // sparkle stars
    for (const [x, y, r] of [[196, 44, 7], [222, 84, 5], [30, 130, 5]]) {
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.36 : r; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.closePath(); c.fill();
    }
  }));
  reg('rug', atlas.tile('rug', 128, 128, (c) => {
    c.fillStyle = '#6e2f3a'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#c9a24e'; c.lineWidth = 4; c.strokeRect(8, 8, 112, 112);
    c.strokeStyle = 'rgba(240,230,200,0.5)'; c.lineWidth = 2; c.strokeRect(18, 18, 92, 92);
    speckle(c, R, 128, 128, 260, ['rgba(0,0,0,0.12)'], 1, 3);
  }));

  // --- vehicle component detail: panelled flanks (door seams, handles, skirt,
  // wheel arches), cabin glass with a simple interior showing through (seat
  // backs, headrests, dash, steering wheel), a windshield with dash + wheel +
  // mirror + wipers, a grille mesh, truck flank art and a stock-car sponsor board.
  const flankBase = (c, w, h, taxi, stock) => {
    c.fillStyle = '#e8e6e0'; c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(20,20,24,0.55)'; c.fillRect(0, h - 14, w, 14); // side-skirt shadow band
    c.strokeStyle = 'rgba(25,25,30,0.6)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 10); c.lineTo(w, 10); c.stroke(); // shoulder crease
    for (const dx of [0.36, 0.62]) { c.beginPath(); c.moveTo(w * dx, 12); c.lineTo(w * dx, h - 16); c.stroke(); } // door seams
    c.fillStyle = 'rgba(30,30,34,0.85)';
    c.fillRect(w * 0.30, 26, 16, 5); c.fillRect(w * 0.56, 26, 16, 5); // door handles
    c.strokeStyle = 'rgba(25,25,30,0.5)';
    for (const ax of [30, w - 30]) { c.beginPath(); c.arc(ax, h, 34, Math.PI, 2 * Math.PI); c.stroke(); } // wheel-arch shading
    c.beginPath(); c.arc(w * 0.8, 44, 7, 0, 7); c.stroke(); // fuel flap
    if (taxi) for (let x = 0; x < w; x += 16) for (let y = 0; y < 2; y++)
      if ((x / 16 + y) % 2 === 0) { c.fillStyle = '#191919'; c.fillRect(x, h - 34 + y * 10, 16, 10); } // checker band
    if (stock) { c.fillStyle = '#a33327'; c.fillRect(0, 40, w, 12); c.fillStyle = '#26303a'; c.fillRect(0, 54, w, 5); } // sponsor stripes
  };
  reg('carFlank', atlas.tile('carFlank', 256, 128, (c) => flankBase(c, 256, 128, false, false)));
  reg('carFlankTaxi', atlas.tile('carFlankTaxi', 256, 128, (c) => flankBase(c, 256, 128, true, false)));
  reg('carFlankStock', atlas.tile('carFlankStock', 256, 128, (c) => flankBase(c, 256, 128, false, true)));
  reg('cabinSide', atlas.tile('cabinSide', 128, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#8ea5b1'); g.addColorStop(0.6, '#4c5c66'); g.addColorStop(1, '#2e3940');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.fillStyle = 'rgba(22,22,26,0.88)'; // the interior, seen through the glass
    c.fillRect(16, 62, 26, 66); c.fillRect(20, 40, 18, 24); // front seat + headrest
    c.fillRect(78, 62, 30, 66); c.fillRect(84, 42, 18, 22); // rear seat + headrest
    c.fillStyle = 'rgba(22,22,26,0.75)'; c.fillRect(0, 96, 30, 32); // dash edge
    c.strokeStyle = 'rgba(15,15,18,0.9)'; c.lineWidth = 4; c.beginPath(); c.arc(24, 88, 11, 0, 7); c.stroke(); // steering wheel
    c.fillStyle = 'rgba(255,255,255,0.30)'; c.beginPath(); c.moveTo(30, 128); c.lineTo(66, 0); c.lineTo(84, 0); c.lineTo(48, 128); c.fill(); // reflection streak
  }));
  reg('windshield', atlas.tile('windshield', 128, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#93aebb'); g.addColorStop(0.55, '#54656f'); g.addColorStop(1, '#333f47');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.fillStyle = 'rgba(20,20,24,0.92)'; c.fillRect(0, 100, 128, 28); // dashboard
    c.fillStyle = 'rgba(70,80,88,0.9)'; c.fillRect(10, 106, 34, 5); c.fillRect(84, 106, 34, 5); // dash vents
    c.strokeStyle = 'rgba(12,12,15,0.95)'; c.lineWidth = 5; c.beginPath(); c.arc(38, 96, 14, 0, 7); c.stroke(); // steering wheel
    c.fillStyle = 'rgba(12,12,15,0.9)'; c.fillRect(56, 6, 18, 9); // rear-view mirror
    c.strokeStyle = 'rgba(15,15,18,0.85)'; c.lineWidth = 3.4; // wipers at rest
    c.beginPath(); c.moveTo(30, 126); c.lineTo(52, 100); c.stroke();
    c.beginPath(); c.moveTo(98, 126); c.lineTo(78, 102); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.26)'; c.beginPath(); c.moveTo(14, 128); c.lineTo(52, 0); c.lineTo(70, 0); c.lineTo(32, 128); c.fill();
  }));
  reg('grille', atlas.tile('grille', 128, 64, (c) => {
    c.fillStyle = '#17181a'; c.fillRect(0, 0, 128, 64);
    c.fillStyle = 'rgba(190,196,200,0.5)';
    for (let x = 6; x < 128; x += 10) c.fillRect(x, 8, 3, 48); // mesh slats
    c.fillStyle = 'rgba(220,224,228,0.75)'; c.fillRect(0, 28, 128, 5); // chrome bar
  }));
  reg('truckSide', atlas.tile('truckSide', 256, 128, (c) => {
    c.fillStyle = '#dcd9d2'; c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#31517d'; c.fillRect(0, 0, 256, 26); c.fillRect(0, 104, 256, 24);
    centeredText(c, 'PALMERA FREIGHT', 138, 58, 'bold 32px sans-serif', '#31517d');
    centeredText(c, 'PORT · CITY · HILL — WE HAUL', 138, 84, 'bold 13px sans-serif', 'rgba(40,50,60,0.75)');
    c.fillStyle = '#e83e8c'; c.beginPath(); c.arc(34, 58, 14, 0, 7); c.fill(); // magenta disc mark
    c.fillStyle = '#f5f2ea'; c.beginPath(); c.arc(34, 58, 6, 0, 7); c.fill();
  }));
  reg('sponsor', textTile(atlas, 'sponsor', 256, 64, (c) => {
    c.fillStyle = '#ece7da'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#a33327'; c.fillRect(0, 0, 256, 8); c.fillRect(0, 56, 256, 8);
    centeredText(c, 'VOSS OIL', 128, 27, 'bold 25px sans-serif', '#26303a', 2);
    centeredText(c, 'COCO FM 101.1 · TACO MAR', 128, 48, 'bold 12.5px sans-serif', 'rgba(30,34,40,0.85)');
  }));
  return T;
}
