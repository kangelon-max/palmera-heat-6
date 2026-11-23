// Palmera Bay: a seeded coastal city built once into static geometry — five
// districts, a grid of streets, ~110 textured buildings, the pier and ferris
// wheel, the port, the observatory hill, the PALMERA letters, Muscle Sands gym,
// the ghost's corner and the PBPD headquarters with its neon stiletto bait sign.
import { rngStream } from './random.js';

export const WORLD = {
  minX: -230, maxX: 230, minZ: -210, maxZ: 210,
  shoreZ: -118, // water north of this line
  avenues: [-176, -128, -80, -32, 16, 64, 112, 160],   // N-S streets (x)
  streets: [-72, -24, 24, 72, 120, 168],               // E-W streets (z)
  roadHalf: 7,
  hq: { x: 40, z: -48 },          // PBPD HQ block centre (downtown)
  ghost: { x: -56, z: -103 },     // make.fun ghost corner on the promenade
  wheel: { x: 2, z: -182, r: 17 },
  pier: { x0: -9, x1: 13, z0: -186, z1: -116, deckY: 1.7 },
  lighthouse: { x: -186, z: -176 },
  cranes: [{ x: 178, z: -60 }, { x: 196, z: 6 }],
  observatory: { x: -168, z: 128 },
  garage: { x: 88, z: 47 },
  gym: { x: 96, z: -128 },
  sahurSpot: { x: -120, z: 60 },
  colliders: [],   // {x0,z0,x1,z1} solid footprints
  lamps: [],       // {x,z} street lamp positions (light pools at night)
  palms: [],
  signs: [],       // {x,z,label} for the map
  blocks: [],      // city blocks for the map {x0,z0,x1,z1}
};
const AV = WORLD.avenues, ST = WORLD.streets;

export function districtAt(x, z) {
  if (z < WORLD.shoreZ) return 'Palmera Bay';
  if (Math.hypot(x - WORLD.observatory.x, z - WORLD.observatory.z) < 62) return 'Observatory Hill';
  if (x >= 132) return 'Port of Palmera';
  if (z < -84) return (x > 52 && z < -108) ? 'Muscle Sands' : 'Beachfront & Palmera Pier';
  if (x <= -132) return 'Observatory Hill';
  return 'Downtown';
}
const STREET_NAMES = [
  { axis: 'x', at: -176, name: 'Observatory Road' }, { axis: 'x', at: -128, name: 'Voss Street' },
  { axis: 'x', at: -80, name: 'Coco Avenue' }, { axis: 'x', at: -32, name: 'Dune Street' },
  { axis: 'x', at: 16, name: 'Palm Row' }, { axis: 'x', at: 64, name: 'Marina Boulevard' },
  { axis: 'x', at: 112, name: 'Gull Street' }, { axis: 'x', at: 160, name: 'Harbor Way' },
  { axis: 'z', at: -72, name: 'Boardwalk' }, { axis: 'z', at: -24, name: 'Ember Street' },
  { axis: 'z', at: 24, name: 'Solana Avenue' }, { axis: 'z', at: 72, name: 'Coral Street' },
  { axis: 'z', at: 120, name: 'Fig Street' }, { axis: 'z', at: 168, name: 'South Palmera Road' },
];
export function streetAt(x, z) {
  let best = null, bd = 1e9;
  for (const s of STREET_NAMES) {
    const d = s.axis === 'x' ? Math.abs(x - s.at) : Math.abs(z - s.at);
    if (d < bd) { bd = d; best = s.name; }
  }
  return best;
}
/** Water depth in metres at (x,z); 0 on land. */
export function waterDepth(x, z) {
  if (z >= WORLD.shoreZ) return 0;
  return Math.min(2.6, (WORLD.shoreZ - z) / 16);
}
export function collide(x, z, rad = 0.45) {
  for (const c of WORLD.colliders) {
    if (x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad) return c;
  }
  return null;
}

const FACADE_STYLES = ['stucco', 'brick', 'concrete', 'glass'];
const ROOF_PROPS = 0;

function buildBuilding(r, T, R, cx, cz, w, d, h, style, opts = {}) {
  const tile = T[`facade_${style}${R.int(0, 1)}`];
  const tint = opts.tint || [R.range(0.82, 1.05), R.range(0.82, 1.02), R.range(0.8, 1.0)];
  r.push(); r.translate(cx, 0, cz); if (opts.rotY) r.rotateY(opts.rotY);
  // tall blocks step back: a full-footprint shaft, a cornice band, then a
  // narrower crown tier — skylines stop reading as one extruded box
  const tiered = h >= 15 && !opts.sign;
  const h1 = tiered ? h * 0.62 : h;
  r.push(); r.translate(0, 0.57, 0); r.box(w + 0.55, 1.15, d + 0.55, { tile: T.concrete }, [0.78, 0.76, 0.72]); r.pop(); // plinth: the block sits on a base
  r.push(); r.translate(0, h1 / 2, 0); r.box(w, h1, d, { tile }, tint); r.pop();
  if (tiered) {
    // chamfered transition: four sloped bands lean the shaft into the crown
    const bandM = { tile: T.concrete }, bandT = [0.88, 0.86, 0.82];
    r.push(); r.translate(0, h1 + 0.1, d / 2 - 0.03); r.rotateX(-0.55); r.box(w + 0.24, 0.6, 0.1, bandM, bandT); r.pop();
    r.push(); r.translate(0, h1 + 0.1, -(d / 2 - 0.03)); r.rotateX(0.55); r.box(w + 0.24, 0.6, 0.1, bandM, bandT); r.pop();
    r.push(); r.translate(w / 2 - 0.03, h1 + 0.1, 0); r.rotateZ(0.55); r.box(0.1, 0.6, d + 0.24, bandM, bandT); r.pop();
    r.push(); r.translate(-(w / 2 - 0.03), h1 + 0.1, 0); r.rotateZ(-0.55); r.box(0.1, 0.6, d + 0.24, bandM, bandT); r.pop();
    r.push(); r.translate(0, h1 + 0.42, 0); r.box(w * 0.8 + 0.5, 0.3, d * 0.8 + 0.5, { tile: T.concrete }, [0.92, 0.9, 0.86]); r.pop(); // cornice cap
    r.push(); r.translate(0, h1 + 0.5 + (h - h1 - 0.5) / 2, 0); r.box(w * 0.78, h - h1 - 0.5, d * 0.78, { tile }, tint.map((v) => v * 1.04)); r.pop(); // crown tier
  }
  r.push(); r.translate(0, h + 0.22, 0); r.box((tiered ? w * 0.78 : w) + 0.7, 0.44, (tiered ? d * 0.78 : d) + 0.7, { tile: T.roof }, [0.9, 0.88, 0.85]); r.pop(); // parapet
  if (!tiered && h < 13 && R.chance(0.22)) { // a gabled roofline on some low blocks
    r.push(); r.translate(0, h + 0.4, 0); r.rotateY(R.chance(0.5) ? 0 : Math.PI / 2); r.wedge(w * 0.92, R.range(1.1, 1.9), d * 0.92, { tile: T.roof }, [0.85, 0.6, 0.5]); r.pop();
  }
  if (opts.shop) { // ground-floor shopfront band on the street face
    r.push(); r.translate(0, 1.7, d / 2 + 0.32); r.box(w * 0.94, 3.4, 0.12, { tile: T.shopfront }); r.pop();
    r.push(); r.translate(0, 3.62, d / 2 + 0.55); r.rotateX(0.5); r.box(w * 0.8, 0.08, 1.3, { tile: R.chance(0.5) ? T.awning : T.awningRed }); r.pop();
  }
  // street-face detail density: AC units under random windows (the facade
  // texture's grid is 3 cols x 4 rows, centres at known UV fractions) and
  // an entrance with a canopy for plain blocks
  if (!opts.sign) {
    const colsU = [0.207, 0.5, 0.793], rowsV = [0.861, 0.62, 0.38, 0.139];
    for (let k = 0; k < 2; k++) {
      if (!R.chance(0.65)) continue;
      const wx = (R.pick(colsU) - 0.5) * w, wy = R.pick(rowsV) * h1;
      if (wy > h1 - 1.2 || wy < 1.6) continue;
      r.push(); r.translate(wx, wy - 0.5, d / 2 + 0.18); r.box(0.58, 0.42, 0.34, { tile: T.corrugated }, [0.82, 0.82, 0.8]); r.pop();
    }
    if (!opts.shop && R.chance(0.55)) {
      r.push(); r.translate(0, 1.32, d / 2 + 0.3); r.box(1.7, 2.64, 0.14, { tile: T.white }, [0.16, 0.15, 0.16]); r.pop(); // dark recess
      r.push(); r.translate(0, 2.78, d / 2 + 0.62); r.rotateX(0.22); r.box(2.3, 0.08, 1.0, { tile: T.concrete }, [0.85, 0.83, 0.8]); r.pop(); // canopy
      r.push(); r.translate(0, 0.09, d / 2 + 0.55); r.box(2.0, 0.18, 0.7, { tile: T.concrete }, [0.8, 0.78, 0.74]); r.pop(); // step
    }
  }
  if (opts.sign) {
    r.push(); r.translate(0, h * 0.72, d / 2 + 0.35); r.box(opts.signW || 12, 2.0, 0.5, { tile: T.white }, [0.25, 0.27, 0.3]);
    r.translate(0, 0, 0.28); r.plane(opts.signW || 12, 1.8, T[opts.sign], [1, 1, 1], 0.35); r.pop();
  }
  if (opts.balconies) {
    const floors = Math.max(1, Math.floor(h1 / 3.4) - 1); // balconies live on the shaft, never floating off the crown
    for (let f = 0; f < floors; f++) for (let i = -1; i <= 1; i++) {
      r.push(); r.translate(i * w * 0.28, 3.4 + f * 3.4, d / 2 + 0.5);
      r.box(2.6, 0.14, 1.0, { tile: T.concrete }, [0.85, 0.84, 0.8]);
      r.translate(0, 0.45, 0.45); r.box(2.6, 0.8, 0.06, { tile: T.gunMetal }); r.pop();
    }
  }
  // rooftop props: AC boxes, water tank, antenna, drainpipe
  const props = R.int(1, 3);
  for (let i = 0; i < props; i++) {
    r.push(); r.translate(R.range(-w / 3, w / 3), h + 0.75, R.range(-d / 3, d / 3));
    if (R.chance(0.4)) { r.cylinder(0.7, 1.5, 9, { tile: T.corrugated }, [0.75, 0.72, 0.68]); }
    else r.box(R.range(1, 2), 1.1, R.range(1, 1.8), { tile: T.corrugated }, [0.8, 0.79, 0.76]);
    r.pop();
  }
  r.push(); r.translate(w / 2 - 0.2, h1 / 2, d / 2 - 0.2); r.cylinder(0.09, h1, 6, { tile: T.gunMetal }, [0.5, 0.5, 0.52]); r.pop(); // drainpipe (shaft height, so it hugs the stepped face)
  r.pop();
  WORLD.colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
}

function palm(r, T, R, x, z, lean = 0) {
  const h = R.range(4.6, 6.4);
  r.push(); r.translate(x, 0, z); r.rotateY(R.range(0, Math.PI * 2)); r.rotateZ(lean); r.rotateX(lean * 0.6);
  // trunk: a chained arc of short tapering cylinders — each segment starts
  // exactly where the last ended, in the same tangent direction, so the
  // rings sit flush and the trunk reads as ONE smooth curve, never steps
  const bend = R.range(0.05, 0.13) * (R.chance(0.5) ? 1 : -1);
  const SEGS = 7, segH = h / SEGS;
  let cr = 0.235;
  r.push();
  for (let s = 0; s < SEGS; s++) {
    r.rotateZ((bend / SEGS) * (0.6 + (0.4 * s) / SEGS));
    r.push(); r.translate(0, segH / 2, 0); r.cylinder(cr, segH * 1.3, 8, { tile: T.bark }); r.pop();
    r.translate(0, segH, 0);
    cr -= 0.013;
  }
  // crown bulb: the single join every frond springs from
  r.ball(0.27, 10, 7, T.bark, [0.72, 0.6, 0.44], 0, 0.85);
  // fronds: ribbons that follow a drooping arc, textured with successive
  // lengthwise slices of the leaf tile so the painted silhouette flows
  // unbroken from the crown point to the tip
  const frond = (yawA, tilt0, len, maxW, tintF, roll) => {
    const N = 5, ds = len / N;
    const cy = Math.cos(yawA), sy = Math.sin(yawA);
    let px = 0, py = 0, pz = 0, ang = tilt0, prev = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const dir = [sy * Math.sin(ang), Math.cos(ang), cy * Math.sin(ang)];
      const prof = Math.sin(Math.PI * Math.min(1, 0.08 + 0.9 * t));
      const hw = (maxW * (0.7 + 0.3 * prof)) / 2;
      const wx = [cy, 0, -sy]; // yaw-rotated X axis (the ribbon's width dir)
      const cxv = [dir[1] * wx[2] - dir[2] * wx[1], dir[2] * wx[0] - dir[0] * wx[2], dir[0] * wx[1] - dir[1] * wx[0]];
      const wv = [
        wx[0] * Math.cos(roll) + cxv[0] * Math.sin(roll),
        wx[1] * Math.cos(roll) + cxv[1] * Math.sin(roll),
        wx[2] * Math.cos(roll) + cxv[2] * Math.sin(roll),
      ];
      const pt = { p: [px, py, pz], w: wv, hw, t };
      if (prev) {
        const tile = T.frond;
        const vv = (tt) => tile.v0 + (tile.v1 - tile.v0) * tt;
        const cA = [prev.p[0] - prev.w[0] * prev.hw, prev.p[1] - prev.w[1] * prev.hw, prev.p[2] - prev.w[2] * prev.hw];
        const cB = [prev.p[0] + prev.w[0] * prev.hw, prev.p[1] + prev.w[1] * prev.hw, prev.p[2] + prev.w[2] * prev.hw];
        const cC = [pt.p[0] + pt.w[0] * pt.hw, pt.p[1] + pt.w[1] * pt.hw, pt.p[2] + pt.w[2] * pt.hw];
        const cD = [pt.p[0] - pt.w[0] * pt.hw, pt.p[1] - pt.w[1] * pt.hw, pt.p[2] - pt.w[2] * pt.hw];
        const uvs = [[tile.u0, vv(prev.t)], [tile.u1, vv(prev.t)], [tile.u1, vv(pt.t)], [tile.u0, vv(pt.t)]];
        r.quadUV([cA, cB, cC, cD], tile, tintF, 0, uvs);
        r.quadUV([cB, cA, cD, cC], tile, tintF, 0, [uvs[1], uvs[0], uvs[3], uvs[2]]); // underside too: palms are seen from below
      }
      prev = pt;
      px += dir[0] * ds; py += dir[1] * ds; pz += dir[2] * ds;
      ang += ((0.42 + 0.5 * t) * 2.2 * ds) / len; // the droop accelerates toward the tip
    }
  };
  const green = [1, 1, 1];
  for (let i = 0; i < 7; i++) frond((i / 7) * Math.PI * 2 + R.range(-0.15, 0.15), 0.95 + R.range(-0.1, 0.12), R.range(2.6, 3.2), 1.0, green, (i % 2 ? 1 : -1) * R.range(0.3, 0.55));
  for (let i = 0; i < 6; i++) frond((i / 6) * Math.PI * 2 + 0.45 + R.range(-0.15, 0.15), 0.68 + R.range(-0.08, 0.1), R.range(2.2, 2.7), 0.92, green, (i % 2 ? -1 : 1) * R.range(0.3, 0.55));
  for (let i = 0; i < 2; i++) frond(R.range(0, 6.28), 0.22 + R.range(0, 0.1), R.range(1.5, 1.8), 0.6, [1.12, 1.06, 0.78], 0.3); // upright spears
  for (let i = 0; i < 5; i++) frond((i / 5) * Math.PI * 2 + 0.3, 2.45 + R.range(-0.15, 0.15), R.range(1.0, 1.25), 0.7, [0.55, 0.46, 0.3], 0.2); // dead skirt hanging from the join
  for (let i = 0; i < 5; i++) { // coconuts clustered at the crown join
    const a = (i / 5) * Math.PI * 2 + 0.4;
    r.push(); r.translate(Math.cos(a) * 0.17, -0.17, Math.sin(a) * 0.17); r.ball(0.115, 8, 6, T.bark, [0.5, 0.42, 0.26]); r.pop();
  }
  r.pop();
  r.pop();
  WORLD.colliders.push({ x0: x - 0.25, z0: z - 0.25, x1: x + 0.25, z1: z + 0.25 });
  WORLD.palms.push({ x, z });
}

function lamp(r, T, x, z) {
  r.push(); r.translate(x, 0, z);
  r.push(); r.translate(0, 2.5, 0); r.cylinder(0.07, 5.0, 6, { tile: T.gunMetal }, [0.4, 0.42, 0.45]); r.pop();
  r.push(); r.translate(0.28, 4.95, 0); r.rotateZ(-0.6); r.cylinder(0.045, 1.15, 6, { tile: T.gunMetal }, [0.4, 0.42, 0.45]); r.pop(); // arm curving out over the street
  r.push(); r.translate(0.62, 5.34, 0); r.ball(0.17, 10, 8, T.white, [1.5, 1.35, 1.0], 0.4); r.pop(); // globe
  r.push(); r.translate(0.62, 5.52, 0); r.cylinder(0.1, 0.1, 8, { tile: T.gunMetal }, [0.35, 0.36, 0.4]); r.pop(); // cap
  r.pop();
  WORLD.lamps.push({ x, z });
  WORLD.colliders.push({ x0: x - 0.12, z0: z - 0.12, x1: x + 0.12, z1: z + 0.12 });
}

/** Block letters from boxes (for the PALMERA hillside sign). */
function blockLetter(r, T, ch, x, y, z, s, tint) {
  const FONT = {
    P: ['1110', '1001', '1110', '1000', '1000'], A: ['0110', '1001', '1111', '1001', '1001'],
    L: ['1000', '1000', '1000', '1000', '1111'], M: ['1001', '1111', '1011', '1001', '1001'],
    E: ['1111', '1000', '1110', '1000', '1111'], R: ['1110', '1001', '1110', '1010', '1001'],
  };
  const grid = FONT[ch]; if (!grid) return 0;
  const cell = s / 4;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
    if (grid[row][col] !== '1') continue;
    r.push(); r.translate(x + col * cell, y + (4 - row) * cell, z);
    r.box(cell * 0.92, cell * 0.92, cell * 0.5, { tile: T.white }, tint); r.pop();
  }
  return s * 1.18;
}

export function buildWorld(r, T) {
  const R = rngStream(20261123);
  r.use('static');
  const W = WORLD;

  // ----- ground base: city slab, sand, water -----
  // The slab ends at the shoreline (z=-116): at 380 deep it used to pave 50 m
  // of the bay at y=-0.06, hiding the water plane and rendering the "sea" as
  // a flat sheet of sunlit concrete in every shore view.
  r.push(); r.translate(0, -0.06, 47); r.groundQuad(480, 326, T.concrete, [0.92, 0.9, 0.86]); r.pop();
  for (let ix = 0; ix < 8; ix++) for (let iz = 0; iz < 3; iz++) { // sand strip, tiled
    r.push(); r.translate(-210 + ix * 55, 0.02, -133 + iz * 11); r.groundQuad(55, 11, T.sand); r.pop();
  }
  r.push(); r.translate(0, 0.045, -119.5); r.groundQuad(480, 4.5, T.sandWet); r.pop(); // wet band
  for (let ix = 0; ix < 10; ix++) for (let iz = 0; iz < 4; iz++) { // water, tiled for sparkle scale
    r.push(); r.translate(-216 + ix * 48, -0.4, -138 - iz * 20); r.groundQuad(48, 20, T.water); r.pop();
  }
  for (let ix = 0; ix < 12; ix++) { // foam lace at the shoreline + along the pier
    r.push(); r.translate(-220 + ix * 40, -0.3, -119); r.groundQuad(40, 2.6, T.foam, [1, 1, 1], 0.05); r.pop();
  }
  // grass verges south + observatory hill disc
  r.push(); r.translate(-168, 0, 128); r.cylinder(46, 0.5, 24, { tile: T.grass }, [1, 1, 1], 0, T.grass); r.pop();
  r.push(); r.translate(0, -0.03, 196); r.groundQuad(480, 26, T.grass, [0.95, 0.95, 0.9]); r.pop();

  // ----- roads -----
  for (const x of AV) {
    for (let z = -108; z < 200; z += 32) {
      r.push(); r.translate(x, 0.015, z + 16); r.groundQuad(14, 32, T.asphalt); r.pop();
      r.push(); r.translate(x, 0.03, z + 16); r.groundQuad(3.2, 32, T.roadLine); r.pop();
    }
  }
  for (const z of ST) {
    for (let x = -224; x < 224; x += 32) {
      r.push(); r.translate(x + 16, 0.014, z); r.groundQuad(32, 14, T.asphalt); r.pop();
      r.push(); r.translate(x + 16, 0.028, z); r.rotateY(Math.PI / 2); r.groundQuad(3.2, 32, T.roadLine); r.pop();
    }
  }
  // beachfront promenade
  for (let x = -224; x < 224; x += 32) {
    r.push(); r.translate(x + 16, 0.035, -104); r.groundQuad(32, 12, T.planks, [0.95, 0.92, 0.88]); r.pop();
  }
  // sidewalks around blocks
  for (let bi = 0; bi < AV.length - 1; bi++) for (let bj = 0; bj < ST.length; bj++) {
    const x0 = AV[bi] + 7, x1 = AV[bi + 1] - 7, z0 = (bj === 0 ? -104 : ST[bj - 1] + 7), z1 = (bj === ST.length - 1 ? 196 : ST[bj] - 7) + (bj === ST.length - 1 ? 0 : 0);
    const cz1 = bj === ST.length - 1 ? 196 : ST[bj] - 7;
    const bx0 = x0, bx1 = x1, bz0 = z0, bz1 = cz1;
    if (bx1 - bx0 < 8 || bz1 - bz0 < 8) continue;
    WORLD.blocks.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1 });
    r.push(); r.translate((bx0 + bx1) / 2, 0.07, (bz0 + bz1) / 2); r.box(bx1 - bx0 + 2.4, 0.14, bz1 - bz0 + 2.4, { tile: T.sidewalk }, [1, 1, 1]); r.pop();
  }

  // ----- buildings on blocks (skip special plots) -----
  const special = [
    { x0: 16, z0: -72, x1: 64, z1: -24 },   // HQ block
    { x0: 64, z0: 24, x1: 112, z1: 72 },    // garage block (building placed by hand below)
  ];
  const namedSigns = [
    { sign: 'signHotel', label: 'Hotel Coco' }, { sign: 'signCocoFm', label: 'COCO FM' },
    { sign: 'signTaco', label: 'Taco Mar' }, { sign: 'signGym', label: 'Muscle Sands Gym' },
  ];
  let signIdx = 0;
  for (const b of WORLD.blocks) {
    if (special.some((s) => b.x0 >= s.x0 - 1 && b.x1 <= s.x1 + 1 && b.z0 >= s.z0 - 1 && b.z1 <= s.z1 + 1)) continue;
    if (Math.hypot((b.x0 + b.x1) / 2 - W.observatory.x, (b.z0 + b.z1) / 2 - W.observatory.z) < 58) continue;
    const bw = b.x1 - b.x0, bd = b.z1 - b.z0;
    const split = bw > 30 && R.chance(0.6) ? 2 : 1;
    for (let s = 0; s < split; s++) {
      const cx = b.x0 + (bw * (s + 0.5)) / split, cz = (b.z0 + b.z1) / 2;
      const w = (bw / split) * R.range(0.62, 0.8), d = bd * R.range(0.6, 0.78);
      const downtownBoost = Math.abs(cx) < 110 && cz > -80 && cz < 80 ? 1.5 : 1;
      const h = R.range(7, 15) * downtownBoost * (R.chance(0.16) ? 1.8 : 1);
      const style = FACADE_STYLES[R.int(0, 3)];
      const opts = { shop: R.chance(0.55), balconies: R.chance(0.4) };
      if (signIdx < namedSigns.length && opts.shop && R.chance(0.5)) {
        opts.sign = namedSigns[signIdx].sign; opts.signW = 13;
        WORLD.signs.push({ x: cx, z: cz + d / 2 + 2, label: namedSigns[signIdx].label });
        signIdx++;
      }
      buildBuilding(r, T, R, cx, cz, w, d, h, style, opts);
    }
  }

  // ----- PBPD HQ: the shoe building -----
  {
    const { x, z } = W.hq, w = 34, d = 26, h = 17;
    r.push(); r.translate(x, 0, z);
    r.push(); r.translate(0, h / 2, 0); r.box(w, h, d, { tile: T.facade_concrete0 }, [0.92, 0.95, 1.02]); r.pop();
    r.push(); r.translate(0, 0.57, 0); r.box(w + 0.6, 1.15, d + 0.6, { tile: T.concrete }, [0.8, 0.8, 0.78]); r.pop(); // plinth
    r.push(); r.translate(0, h - 0.5, 0); r.box(w + 0.5, 0.42, d + 0.5, { tile: T.concrete }, [0.85, 0.86, 0.88]); r.pop(); // cornice band
    r.push(); r.translate(0, h + 0.25, 0); r.box(w + 0.8, 0.5, d + 0.8, { tile: T.roof }); r.pop();
    // rooftop helipad on the east side (clear of the heel sign): dark disc, segmented white ring, H, green edge strobes
    r.push(); r.translate(7, h + 0.58, -2); r.cylinder(5.6, 0.2, 18, { tile: T.asphalt }, [0.45, 0.45, 0.48]); r.pop();
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; r.push(); r.translate(7 + Math.cos(a) * 4.9, h + 0.7, -2 + Math.sin(a) * 4.9); r.rotateY(-a); r.box(1.9, 0.05, 0.34, { tile: T.white }, [1.25, 1.25, 1.2], 0.2); r.pop(); }
    for (const hx of [-0.85, 0.85]) { r.push(); r.translate(7 + hx, h + 0.71, -2); r.box(0.55, 0.05, 2.7, { tile: T.white }, [1.3, 1.3, 1.25], 0.25); r.pop(); }
    r.push(); r.translate(7, h + 0.71, -2); r.box(1.15, 0.05, 0.55, { tile: T.white }, [1.3, 1.3, 1.25], 0.25); r.pop();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; r.push(); r.translate(7 + Math.cos(a) * 5.35, h + 0.72, -2 + Math.sin(a) * 5.35); r.box(0.3, 0.13, 0.3, { tile: T.white }, [0.3, 1.1, 0.5], 0.7); r.pop(); }
    WORLD.hqPad = { x: x + 7, y: h + 0.78, z: z - 2 };
    // south face (toward street at z+): department sign, giant banner, HQ sign, awning, steps
    r.push(); r.translate(0, h - 1.6, d / 2 + 0.3); r.plane(27, 2.2, T.signPBPD, [1, 1, 1], 0.3); r.pop();
    r.push(); r.translate(0, h - 5.6, d / 2 + 0.34); r.plane(27, 4.2, T.bannerNiceTry, [1, 1, 1], 0.06); r.pop();
    r.push(); r.translate(0, 3.4, d / 2 + 0.3); r.plane(13, 2.0, T.signHQ, [1, 1, 1], 0.25); r.pop();
    r.push(); r.translate(0, 2.6, d / 2 + 0.9); r.rotateX(0.42); r.box(15, 0.09, 2.2, { tile: T.awning }); r.pop(); // blue-striped awning
    for (let s = 0; s < 3; s++) { r.push(); r.translate(0, 0.18 + s * 0.0, d / 2 + 1.2 + s * 0.55); r.box(9 - s * 0, 0.36, 0.55, { tile: T.concrete }); r.pop(); }
    for (const sx of [-1, 1]) { // flags + bollards
      r.push(); r.translate(sx * (w / 2 - 2), 0, d / 2 + 1.4); r.cylinder(0.06, 6.4, 6, { tile: T.gunMetal }); r.translate(0.7, 5.6, 0); r.box(1.4, 0.85, 0.05, { tile: T.white }, sx < 0 ? [0.25, 0.4, 0.75] : [0.85, 0.3, 0.25]); r.pop();
      for (let bIdx = -1; bIdx <= 1; bIdx++) { r.push(); r.translate(sx * 6 + bIdx * 2.2, 0.4, d / 2 + 2.2); r.cylinder(0.16, 0.8, 8, { tile: T.concrete }, [0.6, 0.6, 0.62]); r.pop(); }
    }
    // the bait: neon stiletto + STILETTO marquee high on the south face
    r.push(); r.translate(-8.5, h + 5.4, d / 2 + 0.6); r.plane(15, 15, T.heelSign, [1.15, 1.1, 1.15], 0.55); r.pop();
    r.push(); r.translate(-8.5, h + 13.6, d / 2 + 0.5); r.box(15.6, 2.6, 0.4, { tile: T.white }, [0.16, 0.12, 0.18]); r.translate(0, 0, 0.24); r.plane(15, 2.3, T.signStiletto, [1, 1, 1], 0.5); r.pop();
    r.push(); r.translate(9, h + 2.4, d / 2 + 0.4); r.box(10, 3.4, 0.5, { tile: T.glassHint || T.facade_glass0 }); r.pop(); // glass annex block
    r.pop();
    WORLD.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    WORLD.signs.push({ x, z: z + d / 2 + 2, label: 'PBPD HQ' });
  }

  // ----- garage -----
  {
    const { x, z } = W.garage;
    buildBuilding(r, T, R, x, z, 26, 20, 8, 'concrete', { sign: 'signGarage', signW: 14 });
    r.push(); r.translate(x, 0, z + 13); r.box(16, 3.2, 0.3, { tile: T.corrugated }, [0.6, 0.62, 0.64]); r.pop(); // shutter door
    WORLD.signs.push({ x, z: z + 14, label: 'Garage' });
  }

  // ----- pier -----
  {
    const P = W.pier;
    r.push(); r.translate((P.x0 + P.x1) / 2, P.deckY - 0.25, (P.z0 + P.z1) / 2); r.box(P.x1 - P.x0, 0.5, P.z1 - P.z0, { tile: T.planks }); r.pop();
    for (let pz = P.z0 + 4; pz < P.z1; pz += 9) for (const px of [P.x0 + 1.2, P.x1 - 1.2]) {
      r.push(); r.translate(px, 0.4, pz); r.cylinder(0.32, 2.6, 8, { tile: T.bark }, [0.7, 0.62, 0.5]); r.pop();
    }
    for (let pz = P.z0 + 3; pz < P.z1 - 2; pz += 4.4) for (const px of [P.x0 + 0.4, P.x1 - 0.4]) { // rails
      r.push(); r.translate(px, P.deckY + 0.55, pz); r.box(0.09, 1.1, 0.09, { tile: T.wood }, [0.75, 0.65, 0.48]); r.pop();
    }
    for (const px of [P.x0 + 0.4, P.x1 - 0.4]) { r.push(); r.translate(px, P.deckY + 1.12, (P.z0 + P.z1) / 2); r.box(0.09, 0.09, P.z1 - P.z0 - 4, { tile: T.wood }, [0.78, 0.68, 0.5]); r.pop(); }
    // pier stalls with striped roofs
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 ? P.x0 + 3.4 : P.x1 - 3.4, sz = -140 - i * 11;
      r.push(); r.translate(sx, P.deckY, sz);
      r.box(4.6, 2.3, 3.4, { tile: T.shopfront });
      // striped roof wedge sits flush on the stall top (it floated 0.45 above
      // it before) and two slim posts carry its overhanging front corners
      r.translate(0, 2.3, 0); r.wedge(5.2, 1.0, 4.0, { tile: T.awningRed }); r.pop();
      for (const px of [-2.45, 2.45]) { r.push(); r.translate(sx + px, P.deckY + 1.15, sz + 1.85); r.cylinder(0.055, 2.3, 6, { tile: T.wood }, [0.6, 0.5, 0.38]); r.pop(); }
      r.push(); r.translate(sx, P.deckY + 3.38, sz - 2.0); r.ball(0.13, 8, 6, T.white, [0.85, 0.3, 0.25]); r.pop(); // roof finial
      WORLD.colliders.push({ x0: sx - 2.3, z0: sz - 1.7, x1: sx + 2.3, z1: sz + 1.7 });
    }
    // string light poles along the pier
    for (let pz = P.z0 + 8; pz < P.z1; pz += 12) for (const px of [P.x0 + 1, P.x1 - 1]) lamp(r, T, px, pz);
  }

  // ----- ferris wheel structure (rotating part drawn per-frame) -----
  {
    const { x, z, r: rad } = W.wheel;
    for (const sx of [-1, 1]) {
      r.push(); r.translate(x + sx * 2.2, 0, z); r.rotateZ(sx * 0.32); r.translate(0, rad * 0.52, 0); r.box(0.55, rad * 1.1, 0.55, { tile: T.gunMetal }, [0.65, 0.67, 0.7]); r.pop();
    }
    r.push(); r.translate(x, 0.4, z); r.box(9, 0.8, 6, { tile: T.planks }); r.pop(); // wheel apron
    WORLD.colliders.push({ x0: x - 4, z0: z - 3, x1: x + 4, z1: z + 3 });
  }

  // ----- lighthouse -----
  {
    const { x, z } = W.lighthouse;
    r.push(); r.translate(x, -0.4, z); r.cylinder(7, 1.2, 10, { tile: T.concrete }, [0.55, 0.53, 0.5]); r.pop(); // rock
    r.push(); r.translate(x, 6.4, z); r.cylinder(2.0, 13.6, 12, { tile: T.white }, [0.88, 0.86, 0.82]); r.pop();
    r.push(); r.translate(x, 10.4, z); r.cylinder(2.06, 2.6, 12, { tile: T.white }, [0.62, 0.2, 0.16]); r.pop(); // red band
    r.push(); r.translate(x, 13.9, z); r.cylinder(1.5, 1.6, 10, { tile: T.carGlass }, [1.4, 1.35, 1.1], 0.5); r.pop(); // lamp room
    r.push(); r.translate(x, 15.2, z); r.cylinder(1.7, 0.9, 10, { tile: T.roof }, [0.4, 0.38, 0.36]); r.pop();
    WORLD.colliders.push({ x0: x - 2.4, z0: z - 2.4, x1: x + 2.4, z1: z + 2.4 });
    WORLD.signs.push({ x, z, label: 'Lighthouse' });
  }

  // ----- port: cranes, containers, warehouses -----
  for (const c of W.cranes) {
    r.push(); r.translate(c.x, 0, c.z);
    for (const [lx, lz] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) { r.push(); r.translate(lx, 11, lz); r.box(1.1, 22, 1.1, { tile: T.gunMetal }, [0.72, 0.45, 0.2]); r.pop(); }
    r.push(); r.translate(0, 22.6, 0); r.box(17, 1.6, 12, { tile: T.gunMetal }, [0.78, 0.5, 0.22]); r.pop();
    r.push(); r.translate(-13, 21.4, 0); r.box(12, 1.1, 1.1, { tile: T.gunMetal }, [0.78, 0.5, 0.22]); r.pop(); // boom over the water side
    r.push(); r.translate(-17, 15, 0); r.box(0.16, 12, 0.16, { tile: T.gunMetal }); r.translate(0, -6.4, 0); r.box(2.6, 1.4, 2.6, { tile: T.corrugated }, [0.5, 0.55, 0.6]); r.pop();
    r.pop();
    WORLD.colliders.push({ x0: c.x - 8, z0: c.z - 6, x1: c.x + 8, z1: c.z + 6 });
  }
  const CONT_TINTS = [[0.62, 0.32, 0.22], [0.25, 0.42, 0.55], [0.35, 0.5, 0.32], [0.6, 0.5, 0.25], [0.45, 0.45, 0.48]];
  for (let i = 0; i < 26; i++) {
    const cx = R.range(146, 214), cz = R.range(-96, 96), rot = R.chance(0.5) ? 0 : Math.PI / 2;
    const lvl = R.chance(0.35) ? 1 : 0;
    r.push(); r.translate(cx, 1.3 + lvl * 2.6, cz); r.rotateY(rot); r.box(6, 2.6, 2.4, { tile: T.corrugated }, R.pick(CONT_TINTS));
    for (const px of [-2.92, 2.92]) for (const pz of [-1.12, 1.12]) { r.push(); r.translate(px, 0, pz); r.box(0.2, 2.64, 0.2, { tile: T.corrugated }, [0.3, 0.3, 0.32]); r.pop(); } // corner castings
    r.pop();
    if (!lvl) WORLD.colliders.push({ x0: cx - 3.2, z0: cz - 3.2, x1: cx + 3.2, z1: cz + 3.2 });
  }
  for (let i = 0; i < 3; i++) {
    const cx = 168 + i * 22, cz = 132;
    r.push(); r.translate(cx, 4, cz); r.box(18, 8, 22, { tile: T.corrugated }, [0.7, 0.68, 0.64]); r.translate(0, 4.6, 0); r.wedge(19, 1.6, 23, { tile: T.roof }); r.pop();
    WORLD.colliders.push({ x0: cx - 9, z0: cz - 11, x1: cx + 9, z1: cz + 11 });
  }
  WORLD.signs.push({ x: 178, z: -40, label: 'Port of Palmera' });

  // ----- observatory -----
  {
    const { x, z } = W.observatory;
    r.push(); r.translate(x, 3.2, z); r.cylinder(9, 6.4, 16, { tile: T.concrete }, [0.88, 0.87, 0.84]); r.pop();
    r.push(); r.translate(x, 7.3, z); r.ball(7.7, 18, 10, T.corrugated, [0.62, 0.66, 0.7], 0, 0.6); r.pop(); // true dome
    r.push(); r.translate(x, 10.4, z - 1.6); r.rotateX(0.55); r.box(1.6, 0.5, 5.0, { tile: T.gunMetal }, [0.3, 0.3, 0.34]); r.pop(); // telescope slit housing
    r.push(); r.translate(x + 12, 1.4, z + 6); r.box(10, 2.8, 7, { tile: T.facade_concrete1 }); r.translate(0, 2.2, 0); r.plane(9, 1.7, T.signObservatory, [1, 1, 1], 0.2); r.pop();
    WORLD.colliders.push({ x0: x - 9, z0: z - 9, x1: x + 9, z1: z + 9 });
    WORLD.signs.push({ x, z, label: 'Observatory' });
  }

  // ----- PALMERA letters on the southern ridge -----
  {
    let lx = -52; const ly = 7.5, lz = 196;
    r.push(); r.translate(0, 0, lz + 8); r.rotateX(-0.32); r.groundQuad(300, 40, T.grass, [0.9, 0.9, 0.85]); r.pop(); // slope
    for (const ch of 'PALMERA') lx += blockLetter(r, T, ch, lx, ly, lz, 8.6, [0.94, 0.91, 0.84]);
    WORLD.signs.push({ x: 0, z: lz, label: 'Palmera Sign' });
  }

  // ----- Muscle Sands outdoor gym -----
  {
    const { x, z } = W.gym;
    r.push(); r.translate(x, 0.06, z); r.groundQuad(30, 16, T.concrete, [0.9, 0.88, 0.84]); r.pop();
    for (let i = 0; i < 4; i++) { // bench + barbell racks
      const bx = x - 11 + i * 7;
      r.push(); r.translate(bx, 0.45, z - 3); r.box(2.2, 0.16, 0.55, { tile: T.wood }, [0.7, 0.58, 0.4]); r.pop();
      for (const sx of [-1, 1]) {
        r.push(); r.translate(bx + sx * 1.1, 0.8, z - 3); r.box(0.12, 1.6, 0.12, { tile: T.gunMetal });
        r.translate(0, 0.85, 0); r.rotateZ(Math.PI / 2); r.cylinder(0.3, 0.08, 10, { tile: T.gunMetal }, [0.25, 0.25, 0.27]); r.pop();
      }
      r.push(); r.translate(bx, 1.68, z - 3); r.rotateZ(Math.PI / 2); r.cylinder(0.045, 2.6, 6, { tile: T.gunMetal }, [0.6, 0.6, 0.62]); r.pop();
    }
    for (let i = 0; i < 3; i++) { // pull-up frames
      const px = x - 8 + i * 8;
      for (const sx of [-1, 1]) { r.push(); r.translate(px + sx * 1.4, 1.3, z + 4); r.box(0.12, 2.6, 0.12, { tile: T.gunMetal }); r.pop(); }
      r.push(); r.translate(px, 2.62, z + 4); r.rotateZ(Math.PI / 2); r.cylinder(0.04, 3, 6, { tile: T.gunMetal }, [0.6, 0.6, 0.62]); r.pop();
    }
    WORLD.signs.push({ x, z, label: 'Muscle Sands Gym' });
  }

  // ----- ghost corner dressing: rug + banner posts (ghost + crowd are dynamic) -----
  {
    const { x, z } = W.ghost;
    r.push(); r.translate(x, 0.06, z); r.groundQuad(9, 7, T.rug); r.pop();
    for (const sx of [-1, 1]) { r.push(); r.translate(x + sx * 5.4, 1.9, z - 2.6); r.cylinder(0.07, 3.8, 6, { tile: T.bark }, [0.6, 0.5, 0.38]); r.pop(); }
    r.push(); r.translate(x, 3.9, z - 2.6); r.plane(11.4, 1.05, T.bannerGhost, [1, 1, 1], 0.3); r.pop();
    WORLD.signs.push({ x, z, label: 'Ghost Drop' });
  }

  // ----- palms + lamps + benches + bins along the promenade and streets -----
  for (let x = -216; x < 224; x += 16) { palm(r, T, R, x + R.range(-2, 2), -112 + R.range(-1.5, 1.5), R.range(-0.05, 0.05)); if (x % 32 === 0) lamp(r, T, x + 6, -99); }
  for (let i = 0; i < 46; i++) palm(r, T, R, R.range(-220, 220), R.range(-116, -122), R.range(-0.06, 0.06));
  for (const x of AV) for (let z = -60; z < 190; z += 48) lamp(r, T, x + 7.6, z);
  for (let i = 0; i < 26; i++) { // benches + bins on the promenade
    const bx = R.range(-215, 215), bz = -99.5;
    r.push(); r.translate(bx, 0.45, bz); r.box(2.2, 0.1, 0.55, { tile: T.wood }, [0.72, 0.6, 0.42]); r.translate(0, -0.4, 0); r.box(2.0, 0.4, 0.45, { tile: T.gunMetal }, [0.3, 0.32, 0.3]); r.pop();
    for (const by of [0.82, 1.06]) { r.push(); r.translate(bx, by, bz + 0.3); r.rotateX(-0.16); r.box(2.2, 0.09, 0.05, { tile: T.wood }, [0.72, 0.6, 0.42]); r.pop(); } // backrest slats
    if (i % 2) { r.push(); r.translate(bx + 2, 0.5, bz); r.cylinder(0.32, 1.0, 8, { tile: T.corrugated }, [0.35, 0.42, 0.38]); r.pop(); }
  }
  r.use('frame');
}

/** Rotating ferris wheel + gondolas, drawn per frame. The wheel's face is in the
 *  XY plane (it greets the beach to the south) and it turns about the Z axis. */
export function drawWheel(r, T, t) {
  const { x, z, r: rad } = WORLD.wheel;
  const cy = rad + 2.2, rot = t * 0.12;
  r.push(); r.translate(x, cy, z); r.rotateZ(rot);
  for (let i = 0; i < 16; i++) { // twin rim rings (front + back) with cross braces + posts
    const a = (i / 16) * Math.PI * 2;
    for (const zz of [-0.55, 0.55]) { r.push(); r.rotateZ(a + Math.PI / 16); r.translate(0, rad, zz); r.box(6.7, 0.46, 0.4, { tile: T.gunMetal }, [0.82, 0.84, 0.87]); r.pop(); }
    r.push(); r.rotateZ(a + Math.PI / 16); r.translate(0, rad, 0); r.box(0.3, 0.3, 1.4, { tile: T.gunMetal }, [0.7, 0.72, 0.75]); r.pop();
    r.push(); r.rotateZ(a); r.translate(0, rad, 0); r.box(0.4, 1.8, 0.4, { tile: T.white }, [0.95, 0.5, 0.55]); r.pop();
  }
  for (let i = 0; i < 8; i++) { // spokes, doubled for substance
    for (const zz of [-0.5, 0.5]) { r.push(); r.rotateZ((i / 8) * Math.PI); r.translate(0, 0, zz); r.box(0.3, rad * 2, 0.26, { tile: T.gunMetal }, [0.78, 0.8, 0.83]); r.pop(); }
  }
  r.push(); r.rotateX(Math.PI / 2); r.cylinder(1.6, 2.4, 12, { tile: T.gunMetal }, [0.88, 0.62, 0.3]); r.pop(); // hub
  r.pop();
  // gondolas hang plumb at their rim points: hanger arm, glass cabin, coloured skirt, roof
  const gondolaTints = [[0.85, 0.3, 0.28], [0.25, 0.55, 0.85], [0.9, 0.65, 0.2], [0.35, 0.75, 0.45], [0.7, 0.4, 0.8], [0.9, 0.5, 0.25], [0.3, 0.75, 0.75], [0.85, 0.4, 0.55]];
  for (let i = 0; i < 8; i++) {
    const th = (i / 8) * Math.PI * 2 + rot;
    const gx = x - Math.sin(th) * rad, gy = cy + Math.cos(th) * rad;
    r.push(); r.translate(gx, gy, z); r.rotateZ(Math.sin(t * 0.9 + i * 1.35) * 0.045); r.translate(0, -1.5, 0); // gondolas sway gently on their hangers
    r.push(); r.translate(0, 1.35, 0); r.box(0.2, 1.1, 0.2, { tile: T.gunMetal }, [0.6, 0.62, 0.65]); r.pop();
    r.box(2.0, 0.75, 2.0, { tile: T.carGlass }, [1.05, 1.05, 1.05]);
    r.push(); r.translate(0, 0.66, 0); r.rotateZ(Math.PI / 2); r.scale(0.38, 1, 1); r.cylinder(1.08, 2.1, 12, { tile: T.white }, [0.92, 0.9, 0.86]); r.pop(); // barrel-vault roof
    r.translate(0, -0.62, 0); r.box(2.05, 0.5, 2.05, { tile: T.white }, gondolaTints[i]);
    r.pop();
    const chase = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
    r.push(); r.translate(gx, gy + 0.4, z); r.billboard(1.6, T.glow, [1.0, 0.75, 0.5], 0.25 + chase * 0.3); r.pop();
  }
  for (let i = 0; i < 16; i++) {
    const th = (i / 16) * Math.PI * 2 + rot;
    r.push(); r.translate(x - Math.sin(th) * rad, cy + Math.cos(th) * rad, z);
    r.billboard(1.1, T.glow, [1.0, 0.8, 0.55], 0.3 + 0.25 * Math.sin(t * 6 + i)); r.pop();
  }
}
