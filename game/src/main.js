// PALMERA HEAT IV — an original open-world crime game in true 3D.
// Third-person camera behind the hero, a living coastal city, modelled weapons,
// swimming, police, story jobs, the ghost's money drop, the PBPD shoe trap and
// one very large wooden man. Everything is generated in code; nothing is loaded.
import { Atlas, Renderer, matPerspective, matLookAt, norm3 } from './gl.js';
import { buildTextures } from './textures.js';
import { drawPerson, drawVehicle, drawWeapon, drawGhost, drawSahur, drawHelicopter, pedAppearance, HERO_APPEARANCE } from './models.js';
import { WORLD, buildWorld, drawWheel, districtAt, streetAt, waterDepth, collide } from './world.js';
import { HUD } from './hud.js';
import { AudioEngine, STATIONS } from './audio.js';
import { rngStream } from './random.js';
import { WEAPON_ORDER } from './weaponart.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 1);

const glCanvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
function fitCanvas() {
  const w = Math.min(innerWidth, 1600), h = Math.min(innerHeight, 900);
  for (const c of [glCanvas, hudCanvas]) { c.width = w; c.height = h; }
}
fitCanvas(); addEventListener('resize', fitCanvas);

const atlas = new Atlas();
const T = buildTextures(atlas);
const renderer = new Renderer(glCanvas, atlas);
buildWorld(renderer, T);
renderer.uploadStatic();
const hud = new HUD(hudCanvas);
const audio = new AudioEngine();


// ---------------- game state ----------------
const RANKS = [[0, 'NOBODY'], [60, 'ERRAND'], [160, 'RUNNER'], [320, 'FIXER'], [560, 'SHOTCALLER'], [900, 'PALMERA ROYALTY']];
const G = {
  mode: SHOT ? 'shot' : 'title',
  time: 10.2, // hours
  money: 120, rp: 0,
  standing: {}, // district -> 0..5
  heat: 0, bust: 0,
  hero: {
    x: -30, z: -96, y: 0, yaw: 0.4, hp: 1, ar: 0.4, weapon: 'pistol',
    ammo: { pistol: 24, smg: 60, shotgun: 12, rifle: 40 },
    reserve: { pistol: 96, smg: 180, shotgun: 36, rifle: 120 },
    walk: 0, moving: false, aiming: false, swim: false, wet: 0, car: null, fallT: 0,
  },
  camYaw: 0.4, camPitch: 0.32,
  jobsDone: 0, jobIdx: -1, stageIdx: 0, collectLeft: 0, standT: 0, followT: 0,
  stats: { carsStolen: 0, shots: 0, bills: 0, swum: 0, busted: 0, sahur: 0 },
  playtime: 0, waypoint: null, tab: 'MAP',
  dialogue: null, toast: null, prompt: null, target: null,
  sahur: { active: false, t: 0, x: WORLD.sahurSpot.x, z: WORLD.sahurSpot.z },
  decoyUntil: 0, hqBeatDone: false, ghostDrip: 0,
  wheelSel: 1, radioIdx: 0, started: false,
};
for (const d of ['Beachfront & Palmera Pier', 'Downtown', 'Port of Palmera', 'Muscle Sands', 'Observatory Hill']) G.standing[d] = 1;

const JOBS = [
  {
    title: 'PIER PRESSURE', giver: 'MARLA VOSS', blurb: 'Act I — Shake down the pier stalls for Marla.',
    stages: [
      { kind: 'go', x: 2, z: -128, line: 'The stall keepers owe me. Stand on the pier and look expensive.' },
      { kind: 'stand', x: 2, z: -150, t: 3, line: 'That is it. Let them see the shotgun. Politely.' },
      { kind: 'escape', x: WORLD.garage.x, z: WORLD.garage.z + 16, line: 'PBPD is rolling — lose the stars, then bring it to the Hill garage.' },
    ],
    reward: [260, 40],
  },
  {
    title: 'GHOST TOWN HUSTLE', giver: 'MARLA VOSS', blurb: 'Act I — The ghost drops more than money. Collect the bundles.',
    stages: [
      { kind: 'go', x: WORLD.ghost.x, z: WORLD.ghost.z + 8, line: 'Our ghost friend drops bundles for the crowd. I want five.' },
      { kind: 'collect', n: 5, cx: WORLD.ghost.x, cz: WORLD.ghost.z, line: 'Grab the bundles before the crowd does.' },
      { kind: 'go', x: -30, z: -92, line: 'Bring them to me at the Boardwalk. And tip the ghost. Manners.' },
    ],
    reward: [340, 55],
  },
  {
    title: 'STOCK CAR HEART', giver: 'DRE', blurb: 'Act II — Borrow the No.7 stock car and run the boulevard checkpoints.',
    stages: [
      { kind: 'steal', x: 96, z: -120, line: 'The No.7 is parked by Muscle Sands. Borrow it. Forever.' },
      { kind: 'drive', x: 64, z: 24, line: 'Checkpoint one: Marina and Solana. Move!' },
      { kind: 'drive', x: -80, z: 24, line: 'Checkpoint two: Coco and Solana. The crowd loves you.' },
      { kind: 'drive', x: WORLD.garage.x, z: WORLD.garage.z + 16, line: 'Park her at the garage. Gently. She is family now.' },
    ],
    reward: [520, 80],
  },
  {
    title: 'HARBOR LIGHTS', giver: 'MARLA VOSS', blurb: 'Act II — A crate at the port needs a quiet ride uphill.',
    stages: [
      { kind: 'go', x: 178, z: -44, line: 'Crane two. The crate with the blue band. Take your time, look casual.' },
      { kind: 'stand', x: 178, z: -44, t: 3, line: 'Loading. Smile at the cameras you cannot see.' },
      { kind: 'drive', x: WORLD.observatory.x + 14, z: WORLD.observatory.z + 8, line: 'Deliver it to the observatory. Science needs it. Do not ask.' },
    ],
    reward: [610, 95],
  },
  {
    title: 'SAHUR PROTOCOL', giver: 'DRE', blurb: 'Act III — Wake the wooden giant. Stay close. Do not run.',
    stages: [
      { kind: 'summon', x: WORLD.sahurSpot.x, z: WORLD.sahurSpot.z, line: 'The stones by Voss Street. Press E and say his name three times.' },
      { kind: 'follow', t: 18, line: 'He walks. You walk with him. It is a respect thing.' },
    ],
    reward: [450, 110],
  },
  {
    title: 'NICE TRY BRO', giver: 'MARLA VOSS', blurb: 'Act III — Walk into the shoe shop that is not a shoe shop.',
    stages: [
      { kind: 'go', x: WORLD.hq.x, z: WORLD.hq.z + 20, line: 'Downtown. Follow the pink heel. Trust me.' },
      { kind: 'escape', x: -32, z: 60, line: 'A COP SHOP. Of course it is. Lose them and reach Dune Street.' },
    ],
    reward: [800, 150],
  },
];

// ---------------- entities ----------------
const R = rngStream(9000 + SEED);
const peds = [], cars = [], parked = [], cops = [], particles = [], ripples = [], pickups = [];
const boats = [
  { x: -60, z: -150, yaw: 0.4, tint: [0.8, 0.78, 0.74], ph: 1 },
  { x: 44, z: -164, yaw: -0.7, tint: [0.55, 0.62, 0.7], ph: 3 },
  { x: 130, z: -146, yaw: 0.1, tint: [0.72, 0.6, 0.5], ph: 5 },
];
function spawnPeds() {
  const spots = [];
  for (let i = 0; i < 34; i++) spots.push({ x: R.range(-215, 215), z: R.range(-108, -94) }); // promenade
  for (let i = 0; i < 16; i++) spots.push({ x: R.range(-160, 160), z: R.pick(WORLD.streets) + R.pick([-9.5, 9.5]) });
  for (const s of spots) {
    peds.push({
      x: s.x, z: s.z, yaw: R.range(0, 6.28), walk: R.range(0, 6), speed: R.range(0.9, 1.5),
      app: pedAppearance(R), tx: s.x + R.range(-30, 30), tz: s.z + R.range(-6, 6),
      state: 'walk', pauseT: R.range(0, 3), downT: 0, fleeT: 0,
    });
  }
  // beachgoers on towels + swimmers
  for (let i = 0; i < 6; i++) peds.push({ x: -140 + i * 22 + R.range(-4, 4), z: -128 + R.range(-3, 3), yaw: 0, walk: 0, speed: 0, app: pedAppearance(R), state: 'sit', pauseT: 0, downT: 0, fleeT: 0 });
  for (let i = 0; i < 5; i++) peds.push({ x: -40 + i * 17, z: -138 - (i % 3) * 7, yaw: R.range(0, 6.28), walk: R.range(0, 6), speed: 0.5, app: pedAppearance(R), state: 'swim', pauseT: 0, downT: 0, fleeT: 0, cx: -40 + i * 17, cz: -138 - (i % 3) * 7 });
  // the ghost crowd: a cheering ring, a queue, one filming
  const gx = WORLD.ghost.x, gz = WORLD.ghost.z;
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.3, rad = 4.6 + (i % 3);
    peds.push({ x: gx + Math.cos(a) * rad, z: gz + Math.sin(a) * rad * 0.8 + 1.5, yaw: Math.atan2(gx - (gx + Math.cos(a) * rad), gz - (gz + Math.sin(a) * rad)) , walk: R.range(0, 6), speed: 0, app: pedAppearance(R), state: i % 3 ? 'cheer' : 'bill', pauseT: 0, downT: 0, fleeT: 0 });
  }
  for (let i = 0; i < 4; i++) peds.push({ x: gx + 8.5, z: gz + 3 + i * 1.6, yaw: -Math.PI / 2, walk: 0, speed: 0, app: pedAppearance(R), state: i === 0 ? 'film' : 'queue', pauseT: 0, downT: 0, fleeT: 0 });
  peds[peds.length - 4].x = gx + 5.5; peds[peds.length - 4].z = gz - 3.4; // the filmer stands on a crate spot
}
const CAR_TINTS = [[0.62, 0.6, 0.58], [0.4, 0.45, 0.55], [0.55, 0.3, 0.26], [0.3, 0.38, 0.32], [0.7, 0.66, 0.6], [0.25, 0.26, 0.3], [0.58, 0.48, 0.3]];
function spawnTraffic() {
  for (let i = 0; i < 15; i++) {
    const vertical = i % 2 === 0;
    const line = vertical ? R.pick(WORLD.avenues) : R.pick(WORLD.streets);
    const dir = R.chance(0.5) ? 1 : -1;
    cars.push({
      vertical, line, dir, pos: R.range(-140, 180), speed: R.range(8, 13), targetSpeed: 0,
      kind: R.pick(['sedan', 'sedan', 'taxi', 'pickup', 'truck']), tint: R.pick(CAR_TINTS),
      wheelSpin: 0, damage: 0, driver: true,
    });
    cars[cars.length - 1].targetSpeed = cars[cars.length - 1].speed;
  }
  cars.push({ vertical: false, line: -24, dir: 1, pos: -60, speed: 10, targetSpeed: 10, kind: 'stock', tint: [0.62, 0.2, 0.16], wheelSpin: 0, damage: 0, driver: true });
  // parked cars along streets + the quest stock car at Muscle Sands
  for (let i = 0; i < 16; i++) {
    const av = R.pick(WORLD.avenues);
    parked.push({ x: av + R.pick([-5.4, 5.4]), z: R.range(-90, 180), yaw: R.chance(0.5) ? 0 : Math.PI, kind: R.pick(['sedan', 'sedan', 'pickup', 'taxi']), tint: R.pick(CAR_TINTS), damage: 0, wheelSpin: 0 });
  }
  parked.push({ x: 96, z: -120, yaw: 0.4, kind: 'stock', tint: [0.62, 0.2, 0.16], damage: 0, wheelSpin: 0, quest: true });
  parked.push({ x: WORLD.garage.x - 8, z: WORLD.garage.z + 15, yaw: 0, kind: 'sedan', tint: [0.45, 0.4, 0.35], damage: 0, wheelSpin: 0 });
}
spawnPeds(); spawnTraffic();
const marla = { x: -30, z: -90, yaw: 2.6, app: { skin: 3, shades: false, hair: 'long', hairTint: [0.12, 0.09, 0.07], shirt: 'clothPlain', shirtTint: [0.62, 0.25, 0.3], pantsTint: [0.2, 0.2, 0.24], shorts: false } };
const dre = { x: WORLD.garage.x + 6, z: WORLD.garage.z + 14, yaw: -0.6, app: { skin: 4, shades: true, hair: 'cap', hairTint: [0.1, 0.1, 0.1], shirt: 'clothDenim', shirtTint: [0.8, 0.8, 0.82], pantsTint: [0.25, 0.25, 0.28], shorts: false, capTint: [0.2, 0.2, 0.22] } };

// ---------------- sky & lighting ----------------
const PHASES = [
  // [hour, sunColor, sunIntensity, ambSky, ambGnd, fog/horizon, zenithTint]
  [0, [0.35, 0.45, 0.65], 0.25, [0.2, 0.23, 0.33], [0.09, 0.1, 0.14], [0.1, 0.13, 0.22]],
  [5, [0.4, 0.48, 0.68], 0.3, [0.2, 0.23, 0.33], [0.09, 0.1, 0.14], [0.16, 0.18, 0.28]],
  [7, [1.0, 0.79, 0.57], 0.9, [0.56, 0.56, 0.59], [0.26, 0.24, 0.21], [0.78, 0.63, 0.52]],
  [10, [1.05, 0.98, 0.88], 1.2, [0.68, 0.72, 0.79], [0.33, 0.31, 0.28], [0.62, 0.72, 0.82]],
  [15, [1.05, 0.95, 0.82], 1.15, [0.66, 0.7, 0.77], [0.33, 0.31, 0.28], [0.6, 0.7, 0.82]],
  [17.5, [1.06, 0.77, 0.5], 1.05, [0.6, 0.58, 0.56], [0.3, 0.27, 0.23], [0.84, 0.64, 0.5]],
  [19, [0.95, 0.5, 0.38], 0.55, [0.36, 0.34, 0.42], [0.16, 0.14, 0.15], [0.62, 0.47, 0.48]],
  [20.5, [0.4, 0.46, 0.66], 0.3, [0.23, 0.26, 0.36], [0.09, 0.1, 0.14], [0.15, 0.18, 0.29]],
  [24, [0.35, 0.45, 0.65], 0.25, [0.2, 0.23, 0.33], [0.09, 0.1, 0.14], [0.1, 0.13, 0.22]],
];
function lerp(a, b, t) { return a + (b - a) * t; }
function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function phaseAt(h) {
  for (let i = 0; i < PHASES.length - 1; i++) {
    const A = PHASES[i], B = PHASES[i + 1];
    if (h >= A[0] && h <= B[0]) {
      const t = (h - A[0]) / (B[0] - A[0] || 1);
      return { sun: lerp3(A[1], B[1], t), sunI: lerp(A[2], B[2], t), ambSky: lerp3(A[3], B[3], t), ambGnd: lerp3(A[4], B[4], t), fog: lerp3(A[5], B[5], t) };
    }
  }
  return { sun: PHASES[0][1], sunI: 0.3, ambSky: PHASES[0][3], ambGnd: PHASES[0][4], fog: PHASES[0][5] };
}
function sunState(h) {
  const ang = ((h - 6) / 12) * Math.PI; // sunrise 6h, sunset 18h
  const el = Math.sin(ang), az = Math.cos(ang);
  if (el > -0.12) return { dir: norm3([az * 0.7, Math.max(el, 0.03), 0.42]), up: true, el };
  const mang = ((h - 18 + 24) % 24 / 12) * Math.PI;
  return { dir: norm3([Math.cos(mang) * 0.6, Math.max(Math.sin(mang), 0.05), -0.4]), up: false, el: Math.sin(mang) };
}
function phaseName(h) {
  if (h < 5) return 'Night'; if (h < 7) return 'Dawn'; if (h < 11.5) return 'Morning';
  if (h < 15) return 'Midday'; if (h < 17.2) return 'Afternoon'; if (h < 18.8) return 'Golden Hour';
  if (h < 20.2) return 'Dusk'; return 'Night';
}
const starPts = []; { const RS = rngStream(4242); for (let i = 0; i < 220; i++) starPts.push([RS.range(-1, 1), RS.range(0.06, 1), RS.range(-1, 1)]); }
const cloudPts = []; { const RS = rngStream(777);
  for (let i = 0; i < 7; i++) cloudPts.push({ layer: 0, x: RS.range(-300, 300), y: RS.range(84, 110), z: RS.range(-300, 300), w: RS.range(80, 130), s: RS.range(0.6, 1) }); // high wisps
  for (let i = 0; i < 14; i++) { const puffs = []; const n = 5 + Math.floor(RS.range(0, 4)); for (let j = 0; j < n; j++) puffs.push({ dx: RS.range(-1, 1), dy: RS.range(0, 0.55), dz: RS.range(-0.4, 0.4), w: RS.range(0.3, 0.62), h: RS.range(0.16, 0.3) }); cloudPts.push({ layer: 1, x: RS.range(-290, 290), y: RS.range(46, 62), z: RS.range(-290, 290), w: RS.range(42, 78), s: RS.range(0.7, 1.3), puffs }); } // cumulus
  for (let i = 0; i < 6; i++) cloudPts.push({ layer: 2, x: RS.range(-290, 290), y: RS.range(48, 60), z: RS.range(-290, 290), w: RS.range(20, 38), s: RS.range(0.8, 1.4) }); // scud, raised: at 28-40 m these slabs hovered in frame like cargo containers
}
const motes = []; { const RS = rngStream(31337); for (let i = 0; i < 150; i++) motes.push([RS.range(-16, 16), RS.range(0.2, 3.4), RS.range(-16, 16), RS.range(0, 6.28)]); }

function drawSky(r, t) {
  const h = G.time, ph = phaseAt(h), sun = sunState(h);
  const night = h < 5.6 || h > 19.6;
  // dome bands around the camera
  const cam = G.camPos || [0, 2, 0];
  const zen = lerp3(ph.fog, night ? [0.04, 0.06, 0.13] : [0.3, 0.48, 0.72], 0.72);
  const bands = 7;
  for (let i = 0; i < bands; i++) {
    const y0 = -30 + i * 26, tint = lerp3(ph.fog, zen, Math.pow((i + 1) / bands, 1.4));
    r.push(); r.translate(cam[0], y0, cam[2]);
    r.cylinder(620, 27, 12, { tile: T.white }, tint, 0, null, true);
    r.pop();
  }
  // sun / moon + glow
  const sd = sun.dir;
  const sunPos = [cam[0] + sd[0] * 560, sd[1] * 560, cam[2] + sd[2] * 560];
  r.push(); r.translate(sunPos[0], sunPos[1], sunPos[2]);
  if (sun.up) {
    r.billboard(190, T.glow, [1.0, 0.72, 0.42], 0.5);
    r.billboard(64, T.glow, [1.3, 1.15, 0.9], 0.95);
  } else {
    r.billboard(175, T.glow, [0.65, 0.75, 0.95], 0.4);
    r.billboard(88, T.moon, [1.1, 1.1, 1.05], 1); // the big cratered moon
  }
  r.pop();
  if (night) for (const s of starPts) {
    r.push(); r.translate(cam[0] + s[0] * 540, s[1] * 480, cam[2] + s[2] * 540);
    r.billboard(2.6, T.glow, [0.9, 0.95, 1.1], 0.75); r.pop();
  }
  // clouds: three drifting layers — high wisps, cumulus clusters with sunlit
  // crowns and shaded bellies (moonlit crowns at night), low fast scud
  const topTint = night ? [0.5, 0.58, 0.75] : [Math.min(1.14, ph.sun[0] * 1.02 + 0.2), Math.min(1.1, ph.sun[1] + 0.17), Math.min(1.06, ph.sun[2] * 0.95 + 0.21)];
  const bellyTint = night ? [0.09, 0.11, 0.18] : lerp3(ph.fog, [0.36, 0.39, 0.5], 0.62); // bellies a breath deeper than the sky, so clusters read as clouds against it
  const wispTint = night ? [0.16, 0.19, 0.3] : lerp3(ph.fog, topTint, 0.35);
  // clouds render as soft billboard puffs (radial glow sprites, overlapping
  // alphas): the old hard-edged white boxes read as floating crates and slabs
  // in stills, never as clouds. Sprites stay camera-facing and depth-tested,
  // so clusters hold together from every angle and tuck behind rooftops.
  for (const c of cloudPts) {
    const speed = c.layer === 0 ? 0.35 : c.layer === 1 ? 1.05 : 2.3;
    const cx = ((c.x + t * speed * c.s + 480) % 960) - 480;
    const bx = cam[0] * 0.4 + cx, bz = cam[2] * 0.4 + c.z;
    if (c.layer === 0) { // wispy streaks: a row of wide, faint puffs
      for (let k = -1; k <= 1; k++) {
        r.push(); r.translate(bx + k * c.w * 0.3, c.y + (k === 0 ? 1.4 : 0), bz + k * 2);
        r.billboard(c.w * 0.52, T.glow, wispTint, 0.3); r.pop();
      }
    } else if (c.layer === 2) { // low scud: darker, faster, broken pairs
      for (let k = 0; k < 2; k++) {
        r.push(); r.translate(bx + (k - 0.5) * c.w * 0.45, c.y + k * 1.1, bz);
        r.billboard(c.w * 0.62, T.glow, lerp3(bellyTint, topTint, 0.2), 0.4); r.pop();
      }
    } else { // cumulus: a shaded belly mass under sunlit crown puffs
      r.push(); r.translate(bx, c.y - c.w * 0.09, bz);
      r.billboard(c.w * 0.85, T.glow, bellyTint, 0.55); r.pop();
      for (const p of c.puffs) {
        const pw = c.w * p.w;
        r.push(); r.translate(bx + p.dx * c.w * 0.32, c.y + c.w * 0.04 + p.dy * c.w * 0.2, bz + p.dz * c.w * 0.3);
        r.billboard(pw * 1.35, T.glow, lerp3(bellyTint, topTint, 0.35 + p.dy * 0.55), 0.55 + p.dy * 0.3);
        r.pop();
      }
    }
  }
  // birds: two dark slats beating in a slow circle
  if (!night) for (let i = 0; i < 5; i++) {
    const a = t * 0.07 + i * 1.35, bx = Math.cos(a) * 90, bz = -120 + Math.sin(a) * 60, by = 42 + Math.sin(t * 0.5 + i) * 3;
    const flap = Math.sin(t * 7 + i * 2) * 0.55;
    r.push(); r.translate(bx, by, bz); r.rotateY(-a);
    r.push(); r.rotateZ(flap); r.translate(-0.9, 0, 0); r.box(1.8, 0.07, 0.4, { tile: T.white }, [0.16, 0.15, 0.16]); r.pop();
    r.push(); r.rotateZ(-flap); r.translate(0.9, 0, 0); r.box(1.8, 0.07, 0.4, { tile: T.white }, [0.16, 0.15, 0.16]); r.pop();
    r.pop();
  }
}

// ================= PART 2 — simulation, input, staging, boot =================
const SAVE_KEY = 'palmera-heat-iv-save-v1';
const MAG = { pistol: 12, smg: 30, shotgun: 6, rifle: 30 };
const FIRE_DT = { fists: 0.38, pistol: 0.24, smg: 0.085, shotgun: 0.85, rifle: 0.13 };
const WRANGE = { fists: 1.7, pistol: 42, smg: 38, shotgun: 20, rifle: 60 };
const CAR_NAMES = { sedan: 'Family Sedan', taxi: 'Palmera Cab', pickup: 'Dune Pickup', truck: 'Palmera Freight Truck', stock: 'No.7 Stock Car', cop: 'PBPD Interceptor', bike: 'Coco GP Bike' };
let simT = 0, lastNow = performance.now(), paused = false, wheelOpen = false;
let mouseDX = 0, mouseDY = 0, mouseDownL = false, mouseDownR = false, pointerLocked = false;
let fireCooldown = 0, reloadT = 0, heroRecoil = 0, copSpawnT = 0, rippleT = 0, billT = 0, saveT = 0;
const heli = { active: false, x: 0, y: 35, z: 0, yaw: 0 };
const keys = {};
G.lastShot = { x: 0, z: 0, t: -99 }; G.lastCrimeT = -99; G.decoyReady = 0; G.hero.vy = 0;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (x1, z1, x2, z2) => Math.hypot(x2 - x1, z2 - z1);
function angLerp(a, b, t) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * clamp(t, 0, 1); }
function rankFor(rp) { let name = RANKS[0][1]; for (const [need, n] of RANKS) if (rp >= need) name = n; return name; }
function stars() { return clamp(Math.ceil(G.heat - 1e-6), 0, 5); }
function fmtClock(h) { const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
function fmtPlay(s) { return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
function say(who, line, dur = 6.5) { G.dialogue = { who, line, until: simT + dur }; }
function showToast(text, dur = 3.4) { G.toast = { text, until: simT + dur }; }
function setStatus(msg) { const el = document.getElementById('status'); if (el) el.textContent = msg; }
function inPier(x, z) { const P = WORLD.pier; return x >= P.x0 && x <= P.x1 && z >= P.z0 && z <= P.z1; }
function groundTargetY() { const h = G.hero; if (inPier(h.x, h.z) && !h.swim) return WORLD.pier.deckY; if (h.swim) return -0.55; return 0; }

// ---------- save / load ----------
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.money, rp: G.rp, jobsDone: G.jobsDone, standing: G.standing, stats: G.stats,
      ammo: G.hero.ammo, reserve: G.hero.reserve, weapon: G.hero.weapon,
    }));
  } catch { /* storage unavailable: the game simply does not persist */ }
}
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s) return false;
    G.money = s.money; G.rp = s.rp; G.jobsDone = s.jobsDone;
    Object.assign(G.standing, s.standing); Object.assign(G.stats, s.stats);
    Object.assign(G.hero.ammo, s.ammo); Object.assign(G.hero.reserve, s.reserve);
    G.hero.weapon = s.weapon || 'pistol';
    return true;
  } catch { return false; }
}
function resetState() {
  const h = G.hero;
  G.money = 120; G.rp = 0; G.jobsDone = 0; G.jobIdx = -1; G.stageIdx = 0; G.heat = 0; G.bust = 0; G.playtime = 0; G.time = 10.2;
  h.x = -30; h.z = -96; h.y = 0; h.yaw = 0.4; h.hp = 1; h.ar = 0.4; h.weapon = 'pistol'; h.vy = 0;
  h.ammo = { pistol: 24, smg: 60, shotgun: 12, rifle: 40 }; h.reserve = { pistol: 96, smg: 180, shotgun: 36, rifle: 120 };
  h.walk = 0; h.moving = false; h.aiming = false; h.swim = false; h.wet = 0; h.car = null;
  G.stats = { carsStolen: 0, shots: 0, bills: 0, swum: 0, busted: 0, sahur: 0 };
  for (const d of Object.keys(G.standing)) G.standing[d] = 1;
  G.sahur.active = false; G.sahur.t = 0; G.hqBeatDone = false; G.dialogue = null; G.toast = null; G.waypoint = null;
  G.lastCrimeT = -99; G.decoyReady = 0;
  cops.length = 0; pickups.length = 0; particles.length = 0; ripples.length = 0;
  G.camYaw = 0.4; G.camPitch = 0.32;
}
function startGame(load) {
  resetState();
  if (load) loadSave();
  G.mode = 'play'; G.started = true; paused = false; wheelOpen = false;
  setStatus('Palmera Heat IV — game started');
  if (G.jobsDone < JOBS.length) say('MARLA VOSS', JOBS[G.jobsDone].blurb + ' Come see me on the Boardwalk.', 7.5);
  else say('MARLA VOSS', 'The whole rent book is yours now. Enjoy the bay.', 6);
}

// ---------- input ----------
function selectWeapon(w) { G.hero.weapon = w; if (audio.started) audio.click(); }
function canvasPoint(e) {
  const r = hudCanvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * hudCanvas.width / r.width, y: (e.clientY - r.top) * hudCanvas.height / r.height };
}
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  if (G.mode !== 'play') return;
  keys[e.code] = true;
  audio.start();
  if (e.code === 'Tab') { wheelOpen = !wheelOpen; if (wheelOpen) { paused = false; G.wheelSel = WEAPON_ORDER.indexOf(G.hero.weapon); } }
  if (e.code === 'KeyM') { paused = !paused; wheelOpen = false; }
  if (e.code === 'Escape') { if (wheelOpen) wheelOpen = false; else if (paused) paused = false; }
  if (e.code.startsWith('Digit')) {
    const i = Number(e.code.slice(5)) - 1;
    if (WEAPON_ORDER[i]) { selectWeapon(WEAPON_ORDER[i]); wheelOpen = false; }
  }
  if (e.repeat) return;
  if (e.code === 'KeyF') toggleCar();
  if (e.code === 'KeyG') useDecoy();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyR' && G.hero.car) {
    G.radioIdx = (G.radioIdx + 1) % STATIONS.length;
    if (audio.started) { audio.station = G.radioIdx; audio.trackIdx = 0; audio.step = 0; }
    showToast(audio.started ? audio.trackName() : STATIONS[G.radioIdx].name, 2.6);
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousemove', (e) => { if (pointerLocked && G.mode === 'play') { mouseDX += e.movementX; mouseDY += e.movementY; } });
addEventListener('mousedown', (e) => {
  const p = canvasPoint(e);
  if (G.mode === 'title') {
    const id = hud.hit(p.x, p.y);
    if (id === 'new') startGame(false);
    else if (id === 'continue') startGame(true);
    return;
  }
  if (G.mode !== 'play') return;
  audio.start();
  if (paused) { handlePauseClick(p); return; }
  if (wheelOpen) { handleWheelClick(p); return; }
  if (!pointerLocked) { glCanvas.requestPointerLock(); return; }
  if (e.button === 0) mouseDownL = true;
  if (e.button === 2) mouseDownR = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDownL = false; if (e.button === 2) mouseDownR = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === glCanvas;
  if (!pointerLocked) { mouseDownL = false; mouseDownR = false; }
});
function handlePauseClick(p) {
  const id = hud.hit(p.x, p.y);
  if (id && id.startsWith('tab:')) { G.tab = id.slice(4); return; }
  if (id === 'resume') { paused = false; return; }
  if (id === 'savequit') { saveGame(); paused = false; G.mode = 'title'; setStatus('Saved. Back at the title screen.'); return; }
  if (G.tab === 'MAP' && hud.mapRect) {
    const m = hud.mapRect;
    if (p.x >= m.x && p.x <= m.x + m.size && p.y >= m.y && p.y <= m.y + m.size) {
      G.waypoint = { x: WORLD.minX + (p.x - m.x) / m.scale, z: WORLD.minZ + (p.y - m.y) / m.scale };
      showToast('Waypoint set', 1.6);
    }
  }
}
function handleWheelClick(p) {
  const dx = p.x - hudCanvas.width / 2, dy = p.y - hudCanvas.height / 2;
  if (Math.hypot(dx, dy) < 84) { wheelOpen = false; return; }
  const idx = ((Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI * 2 / 5)) % 5) + 5) % 5;
  selectWeapon(WEAPON_ORDER[idx]);
  wheelOpen = false;
}

// ---------- combat & consequences ----------
function witnessed() {
  const h = G.hero;
  for (const c of cops) if (dist2(h.x, h.z, c.x, c.z) < 48) return true;
  for (const p of peds) if (p.state !== 'down' && dist2(h.x, h.z, p.x, p.z) < 26) return true;
  return false;
}
function addHeat(v) {
  G.heat = clamp(G.heat + (witnessed() ? v : v * 0.35), 0, 5);
  G.lastCrimeT = simT;
}
function knockDown(p) {
  if (p.state === 'down') return;
  p.state = 'down'; p.downT = 5 + R.range(0, 3);
}
function spark(x, y, z, n = 6) {
  for (let i = 0; i < n; i++) particles.push({ kind: 'spark', x, y, z, vx: R.range(-1.6, 1.6), vy: R.range(0.5, 2.6), vz: R.range(-1.6, 1.6), life: 0.4, max: 0.4, rot: 0 });
}
function splashAt(x, z, n = 8) {
  for (let i = 0; i < n; i++) particles.push({ kind: 'splash', x: x + R.range(-0.3, 0.3), y: -0.2, z: z + R.range(-0.3, 0.3), vx: R.range(-0.7, 0.7), vy: R.range(1.2, 2.6), vz: R.range(-0.7, 0.7), life: 0.55, max: 0.55, rot: 0 });
  ripples.push({ x, z, rad: 0.4, life: 1.5, max: 1.5 });
  if (audio.started) audio.splash();
}
function fire() {
  const h = G.hero, w = h.weapon;
  fireCooldown = FIRE_DT[w];
  const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw);
  if (w === 'fists') {
    if (audio.started) audio.shot('fists');
    let best = null, bd = WRANGE.fists;
    for (const p of peds) {
      if (p.state === 'down' || p.state === 'swim') continue;
      const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.45) { best = p; bd = d; }
    }
    if (best) { knockDown(best); addHeat(0.3); }
    return;
  }
  if (reloadT > 0 || h.ammo[w] <= 0) { if (h.ammo[w] <= 0 && reloadT <= 0) reloadT = 0.9; return; }
  h.ammo[w]--; G.stats.shots++;
  if (audio.started) audio.shot(w);
  G.lastShot = { x: h.x, z: h.z, t: simT };
  heroRecoil = w === 'shotgun' ? 0.17 : w === 'rifle' ? 0.07 : 0.05;
  const mx = h.x + fx * 0.6, mz = h.z + fz * 0.6;
  particles.push({ kind: 'flash', x: mx, y: h.y + 1.42, z: mz, life: 0.06, max: 0.06, rot: 0 });
  particles.push({ kind: 'casing', x: h.x - fz * 0.22, y: h.y + 1.32, z: h.z + fx * 0.22, vx: -fz * 1.3 + R.range(-0.3, 0.3), vy: 2.3, vz: fx * 1.3 + R.range(-0.3, 0.3), life: 0.8, max: 0.8, rot: R.range(0, 6) });
  // hitscan in 2D along the aim ray: nearest pedestrian, else nearest vehicle
  let bestT = WRANGE[w], hitPed = null, hitCar = null;
  for (const p of peds) {
    if (p.state === 'down' || p.state === 'swim') continue;
    const dx = p.x - h.x, dz = p.z - h.z, t = dx * fx + dz * fz;
    if (t < 1 || t > bestT) continue;
    if (Math.hypot(p.x - (h.x + fx * t), p.z - (h.z + fz * t)) < 0.55) { bestT = t; hitPed = p; hitCar = null; }
  }
  const testCar = (c, cx, cz) => {
    const dx = cx - h.x, dz = cz - h.z, t = dx * fx + dz * fz;
    if (t < 1 || t > bestT) return;
    if (Math.hypot(cx - (h.x + fx * t), cz - (h.z + fz * t)) < 1.35) { bestT = t; hitCar = c; hitPed = null; }
  };
  for (const c of parked) testCar(c, c.x, c.z);
  for (const c of cars) { const tr = trafficTransform(c); testCar(c, tr.x, tr.z); }
  for (const c of cops) testCar(c, c.x, c.z);
  if (hitPed) { knockDown(hitPed); addHeat(0.55); }
  else if (hitCar) {
    hitCar.damage = clamp((hitCar.damage || 0) + 0.25, 0, 1);
    spark(h.x + fx * bestT, 0.9, h.z + fz * bestT);
    addHeat(0.4);
  } else addHeat(0.16);
  if (h.ammo[w] === 0 && h.reserve[w] > 0) reloadT = 0.9;
}

// ---------- cars: enter / exit / decoy / interact ----------
function trafficTransform(c) {
  if (c.vertical) return { x: c.line - 3.1 * c.dir, z: c.pos, yaw: c.dir > 0 ? 0 : Math.PI };
  return { x: c.pos, z: c.line + 3.1 * c.dir, yaw: c.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
}
function toggleCar() {
  const h = G.hero;
  if (h.car) {
    const c = h.car;
    parked.push({ x: c.x, z: c.z, yaw: c.yaw, kind: c.kind, tint: c.tint, damage: c.damage, wheelSpin: 0, quest: c.quest });
    h.x = c.x - Math.cos(c.yaw) * 2.3; h.z = c.z + Math.sin(c.yaw) * 2.3; h.y = 0; h.swim = false;
    h.car = null;
    if (audio.started) audio.engine(false, 0);
    return;
  }
  let best = null, bd = 4.2, from = null;
  for (const c of parked) { const d = dist2(h.x, h.z, c.x, c.z); if (d < bd) { bd = d; best = c; from = 'parked'; } }
  for (const c of cars) { const tr = trafficTransform(c); const d = dist2(h.x, h.z, tr.x, tr.z); if (d < bd) { bd = d; best = c; from = 'traffic'; } }
  if (!best) return;
  if (from === 'parked') {
    parked.splice(parked.indexOf(best), 1);
    h.car = { kind: best.kind, tint: best.tint, x: best.x, z: best.z, yaw: best.yaw, speed: 0, damage: best.damage || 0, wheelSpin: 0, quest: best.quest };
  } else {
    const tr = trafficTransform(best);
    cars.splice(cars.indexOf(best), 1);
    h.car = { kind: best.kind, tint: best.tint, x: tr.x, z: tr.z, yaw: tr.yaw, speed: 0, damage: best.damage || 0, wheelSpin: 0, quest: false };
    // the driver bails out and runs — real streets, real reactions
    peds.push({ x: tr.x + 1.5, z: tr.z + 1, yaw: 0, walk: 0, speed: 3.4, app: pedAppearance(R), tx: tr.x, tz: tr.z, state: 'flee', pauseT: 0, downT: 0, fleeT: 3.5, fleeX: h.x, fleeZ: h.z });
    addHeat(0.5);
  }
  G.stats.carsStolen++;
  if (audio.started) audio.click();
}
function useDecoy() {
  if (G.heat < 0.4) { showToast('No heat to shake — Dre stays on standby', 2.4); return; }
  if (simT < G.decoyReady) { showToast('Dre needs a breather first', 2.4); return; }
  G.decoyUntil = simT + 7; G.decoyReady = simT + 25;
  showToast('Dre is making noise across town — the heat looks the other way', 3.6);
  if (audio.started) audio.ding();
}
function interact() {
  const h = G.hero;
  if (h.car) {
    if (h.car.damage > 0.02 && dist2(h.x, h.z, WORLD.garage.x, WORLD.garage.z + 13) < 11) {
      if (G.money >= 40) { G.money -= 40; h.car.damage = 0; showToast('Repaired — good as new', 2.4); if (audio.started) audio.ding(); }
      else showToast('Repair costs $40 — you are short', 2.4);
    }
    return;
  }
  if (dist2(h.x, h.z, marla.x, marla.z) < 3.4) {
    if (G.jobIdx >= 0) { say('MARLA VOSS', JOBS[G.jobIdx].stages[G.stageIdx].line, 6); return; }
    if (G.jobsDone >= JOBS.length) { say('MARLA VOSS', 'Every job done, every rent paid. The bay is yours.', 6); return; }
    startJob(G.jobsDone);
    return;
  }
  if (dist2(h.x, h.z, dre.x, dre.z) < 3.4) {
    say('DRE', G.heat > 0.4 ? 'Heat on you? Say the word (G) and I will be the loudest man in Palmera for seven seconds.' : 'Wheels are oiled, tank is full. Marla has work if you want it.', 6.5);
    return;
  }
  if (dist2(h.x, h.z, WORLD.sahurSpot.x, WORLD.sahurSpot.z) < 7 && !G.sahur.active) { summonSahur(); return; }
}
function summonSahur() {
  G.sahur.active = true; G.sahur.t = 0; G.sahur.x = WORLD.sahurSpot.x; G.sahur.z = WORLD.sahurSpot.z; G.sahur.yaw = 0.8; G.sahur.a = 0;
  G.stats.sahur++;
  say('DRE', 'TUNG. TUNG. TUNG. He is awake. Walk with him — it is a respect thing.', 6.5);
  showToast('The Sahur has risen', 3);
  if (audio.started) audio.ding();
}

// ---------- jobs ----------
function startJob(i) {
  G.jobIdx = i; G.stageIdx = 0; G.standT = 0; G.followT = 0;
  enterStage();
  setStatus('Job started: ' + JOBS[i].title);
}
function enterStage() {
  const job = JOBS[G.jobIdx], st = job.stages[G.stageIdx];
  G.standT = 0; G.followT = 0;
  say(job.giver, st.line, 7);
  if (st.kind === 'collect') {
    G.collectLeft = st.n; pickups.length = 0;
    const RS = rngStream(500 + G.jobIdx);
    for (let i = 0; i < st.n; i++) {
      const a = RS.range(0, Math.PI * 2), rad = RS.range(2.5, 6.5);
      pickups.push({ x: st.cx + Math.cos(a) * rad, z: st.cz + Math.sin(a) * rad * 0.8 + 1, ph: RS.range(0, 6) });
    }
  }
  if (st.kind === 'escape') G.heat = Math.max(G.heat, G.jobIdx === 0 ? 2.2 : 3);
}
function completeStage() {
  const job = JOBS[G.jobIdx];
  if (audio.started) audio.ding();
  if (G.stageIdx >= job.stages.length - 1) {
    G.money += job.reward[0]; G.rp += job.reward[1];
    const d = districtAt(G.hero.x, G.hero.z);
    if (G.standing[d] !== undefined) G.standing[d] = Math.min(5, G.standing[d] + 1);
    G.jobsDone++; G.jobIdx = -1; pickups.length = 0;
    say(job.giver, `Done. $${job.reward[0]} and my thanks. The rent book grows.`, 6.5);
    showToast(`JOB COMPLETE — ${job.title} · +$${job.reward[0]} · +${job.reward[1]} RP`, 4.5);
    setStatus('Job complete: ' + job.title);
    saveGame();
  } else {
    G.stageIdx++;
    enterStage();
  }
}
function stageTarget() {
  if (G.jobIdx < 0) return null;
  const st = JOBS[G.jobIdx].stages[G.stageIdx];
  if (st.kind === 'collect') return { x: st.cx, z: st.cz };
  if (st.kind === 'summon' || st.kind === 'follow') return G.sahur.active ? { x: G.sahur.x, z: G.sahur.z } : { x: WORLD.sahurSpot.x, z: WORLD.sahurSpot.z };
  if (st.x !== undefined) return { x: st.x, z: st.z };
  return null;
}
function updateJobs(dt) {
  if (G.jobIdx < 0) return;
  const h = G.hero, st = JOBS[G.jobIdx].stages[G.stageIdx];
  const d = st.x !== undefined ? dist2(h.x, h.z, st.x, st.z) : 0;
  switch (st.kind) {
    case 'go': if (d < 6.5) completeStage(); break;
    case 'stand': if (d < 5.5) { G.standT += dt; if (G.standT >= st.t) completeStage(); } else G.standT = Math.max(0, G.standT - dt * 0.5); break;
    case 'collect': if (G.collectLeft <= 0) completeStage(); break;
    case 'steal': if (h.car && h.car.quest) completeStage(); break;
    case 'drive': if (h.car && d < 9) completeStage(); break;
    case 'escape': if (G.heat <= 0.05 && d < 9) completeStage(); break;
    case 'summon': if (G.sahur.active && dist2(h.x, h.z, G.sahur.x, G.sahur.z) < 22) completeStage(); break;
    case 'follow': if (G.sahur.active && dist2(h.x, h.z, G.sahur.x, G.sahur.z) < 26) { G.followT += dt; if (G.followT >= st.t) completeStage(); } break;
  }
}

// ---------- pedestrians: real gaits, real reactions ----------
function pedNewTarget(p) {
  p.tx = clamp(p.x + R.range(-38, 38), WORLD.minX + 5, WORLD.maxX - 5);
  p.tz = clamp(p.z + R.range(-26, 26), -112, 196);
  if (waterDepth(p.tx, p.tz) > 0.2) p.tz = -100 + R.range(-6, 26);
}
function updatePeds(dt) {
  const h = G.hero;
  for (const p of peds) {
    if (p.holdUp > 0) p.holdUp -= dt;
    // reactions: a fresh gunshot nearby, or the hero aiming straight at them
    if (simT - G.lastShot.t < 0.15 && p.state !== 'down' && p.state !== 'swim' && dist2(p.x, p.z, G.lastShot.x, G.lastShot.z) < 22) {
      p.state = 'flee'; p.fleeT = 3.5; p.fleeX = G.lastShot.x; p.fleeZ = G.lastShot.z;
    }
    if (h.aiming && !h.car && p.state === 'walk') {
      const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz);
      if (d < 10 && (dx * Math.sin(h.yaw) + dz * Math.cos(h.yaw)) / (d || 1) > 0.86) p.holdUp = 1.1;
    }
    switch (p.state) {
      case 'down':
        p.downT -= dt;
        if (p.downT <= 0) { p.state = 'flee'; p.fleeT = 3; p.fleeX = h.x; p.fleeZ = h.z; }
        break;
      case 'flee': {
        p.fleeT -= dt;
        const dx = p.x - (p.fleeX ?? h.x), dz = p.z - (p.fleeZ ?? h.z), d = Math.hypot(dx, dz) || 1;
        p.yaw = angLerp(p.yaw, Math.atan2(dx / d, dz / d), dt * 8);
        const ox = p.x, oz = p.z;
        p.x += Math.sin(p.yaw) * 3.4 * dt; p.z += Math.cos(p.yaw) * 3.4 * dt;
        if (collide(p.x, p.z, 0.4) || waterDepth(p.x, p.z) > 0.3) { p.x = ox; p.z = oz; p.yaw += 1.2 * dt; }
        p.walk += dt * 9.5;
        if (p.fleeT <= 0) { p.state = 'walk'; pedNewTarget(p); }
        break;
      }
      case 'swim': {
        p.a = (p.a ?? R.range(0, 6)) + dt * 0.22;
        p.x = p.cx + Math.cos(p.a) * 3.1; p.z = p.cz + Math.sin(p.a) * 2.3;
        p.yaw = Math.atan2(-Math.sin(p.a) * 3.1, Math.cos(p.a) * 2.3);
        p.walk += dt * 2.3;
        p.ripT = (p.ripT ?? R.range(0, 1)) - dt;
        if (p.ripT <= 0) { ripples.push({ x: p.x, z: p.z, rad: 0.3, life: 1.4, max: 1.4 }); p.ripT = 1.3; }
        break;
      }
      case 'cheer': case 'bill': p.walk += dt * 6.5; break;
      case 'walk': {
        if (p.holdUp > 0) break;
        if (p.pauseT > 0) { p.pauseT -= dt; break; }
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        if (d < 1.3) { p.pauseT = R.range(0.4, 3.2); pedNewTarget(p); break; }
        p.yaw = angLerp(p.yaw, Math.atan2(dx, dz), dt * 6);
        const ox = p.x, oz = p.z;
        p.x += Math.sin(p.yaw) * p.speed * dt; p.z += Math.cos(p.yaw) * p.speed * dt;
        if (collide(p.x, p.z, 0.4)) { p.x = ox; p.z = oz; pedNewTarget(p); }
        p.walk += dt * p.speed * 3.6;
        break;
      }
      default: break; // sit / queue / film / stand: they hold their pose
    }
  }
}

// ---------- traffic: lanes, braking, patience ----------
function updateTraffic(dt) {
  const h = G.hero;
  for (const c of cars) {
    const tr = trafficTransform(c);
    let want = c.speed;
    // brake for the hero (in a car or on foot) and for the car ahead in the lane
    const aheadOf = (ox, oz) => {
      const rel = c.vertical ? (oz - tr.z) * c.dir : (ox - tr.x) * c.dir;
      const lat = c.vertical ? Math.abs(ox - tr.x) : Math.abs(oz - tr.z);
      return rel > 0.5 && rel < 8.5 && lat < 2.3;
    };
    if (aheadOf(h.x, h.z)) want = 0;
    for (const o of cars) {
      if (o === c || o.line !== c.line || o.dir !== c.dir || o.vertical !== c.vertical) continue;
      const gap = (o.pos - c.pos) * c.dir;
      if (gap > 0.5 && gap < 9) want = 0;
    }
    for (const p of peds) if (p.state === 'walk' && aheadOf(p.x, p.z)) { want = 0; break; }
    c.targetSpeed = want;
    const cur = c.curSpeed ?? c.speed;
    c.curSpeed = cur + clamp(c.targetSpeed - cur, -14 * dt, 5 * dt);
    c.pos += c.dir * c.curSpeed * dt;
    c.wheelSpin += c.curSpeed * dt / 0.34;
    const lo = c.vertical ? -100 : -216, hi = c.vertical ? 192 : 216;
    if (c.pos > hi) c.pos = lo; if (c.pos < lo) c.pos = hi;
  }
}

// ---------- PBPD: dispatch, roadblocks, air unit, the bust ----------
function spawnCop(fromHQ) {
  const h = G.hero;
  let x, z;
  if (fromHQ) { x = WORLD.hq.x + R.range(-14, 14); z = -24; }
  else {
    const av = WORLD.avenues.reduce((a, b) => Math.abs(b - h.x) < Math.abs(a - h.x) ? b : a);
    const st = WORLD.streets.reduce((a, b) => Math.abs(b - h.z) < Math.abs(a - h.z) ? b : a);
    if (R.chance(0.5)) { x = av; z = clamp(h.z + R.pick([-1, 1]) * R.range(55, 80), -100, 190); }
    else { z = st; x = clamp(h.x + R.pick([-1, 1]) * R.range(55, 80), -215, 215); }
  }
  if (dist2(x, z, h.x, h.z) < 34) { x = -x * 0.6; z = clamp(z + 60, -100, 190); }
  cops.push({ block: false, x, z, yaw: R.range(0, 6.28), speed: 0, wheelSpin: 0, damage: 0, lightSeed: R.int(0, 3) });
}
function updatePolice(dt) {
  const h = G.hero;
  const want = G.heat > 0.05 ? Math.min(1 + Math.ceil(G.heat), 5) : 0;
  const active = cops.filter((c) => !c.block);
  copSpawnT -= dt;
  if (active.length < want && copSpawnT <= 0) { spawnCop(R.chance(0.5)); copSpawnT = 1.1; }
  if (G.heat >= 3 && !cops.some((c) => c.block)) {
    const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw);
    const bx = clamp(h.x + fx * 46, -215, 215), bz = clamp(h.z + fz * 46, -104, 190);
    cops.push({ block: true, x: bx - fz * 3, z: bz + fx * 3, yaw: h.yaw + Math.PI / 2 + 0.25, speed: 0, wheelSpin: 0, damage: 0, lightSeed: 0 });
    cops.push({ block: true, x: bx + fz * 3, z: bz - fx * 3, yaw: h.yaw + Math.PI / 2 - 0.25, speed: 0, wheelSpin: 0, damage: 0, lightSeed: 1 });
  }
  if (G.heat < 1.5) for (let i = cops.length - 1; i >= 0; i--) if (cops[i].block) cops.splice(i, 1);
  const decoy = simT < G.decoyUntil;
  const tx = decoy ? dre.x : h.x, tz = decoy ? dre.z : h.z;
  let nearCop = false;
  for (let i = cops.length - 1; i >= 0; i--) {
    const c = cops[i];
    if (c.block) continue;
    const d = dist2(c.x, c.z, h.x, h.z);
    if (G.heat <= 0.05 && d > 70) { cops.splice(i, 1); continue; }
    if (d < 30) nearCop = true;
    const wantYaw = Math.atan2(tx - c.x, tz - c.z);
    c.yaw = angLerp(c.yaw, wantYaw, dt * (d > 40 ? 1.4 : 2.4));
    const spd = d > 55 ? 17.5 : d > 14 ? 12.5 : 6.5;
    c.speed += clamp(spd - c.speed, -18 * dt, 8 * dt);
    const ox = c.x, oz = c.z;
    c.x += Math.sin(c.yaw) * c.speed * dt;
    if (collide(c.x, c.z, 1.25)) c.x = ox;
    c.z += Math.cos(c.yaw) * c.speed * dt;
    if (collide(c.x, c.z, 1.25)) c.z = oz;
    c.wheelSpin += c.speed * dt / 0.34;
    if (h.car) {
      if (dist2(c.x, c.z, h.car.x, h.car.z) < 3.1 && c.speed > 4) { h.car.damage = clamp(h.car.damage + dt * 0.35, 0, 1); c.speed *= 0.94; spark(h.car.x, 0.8, h.car.z, 2); }
    } else if (d < 4.4) {
      G.bust = clamp(G.bust + dt * (keys.ShiftLeft || keys.ShiftRight ? 0.3 : 0.5), 0, 1);
      if (d < 1.7 && c.speed > 3) { h.hp = clamp(h.hp - dt * 0.7, 0, 1); }
    }
  }
  if (!nearCop || h.car) G.bust = clamp(G.bust - dt * 0.25, 0, 1);
  heli.active = stars() >= 4;
  if (heli.active) {
    heli.x += (h.x + Math.sin(simT * 0.3) * 12 - heli.x) * dt * 1.4;
    heli.z += (h.z + Math.cos(simT * 0.23) * 12 - heli.z) * dt * 1.4;
    heli.yaw = angLerp(heli.yaw, Math.atan2(h.x - heli.x, h.z - heli.z), dt * 2);
  }
  if (audio.started) audio.siren(cops.some((c) => !c.block) && dist2(cops[0]?.x ?? 1e9, cops[0]?.z ?? 1e9, h.x, h.z) < 60);
}
function busted() {
  const h = G.hero;
  G.stats.busted++;
  G.money = Math.max(0, G.money - 150);
  G.heat = 0; G.bust = 0; cops.length = 0;
  if (h.car) { parked.push({ x: h.car.x, z: h.car.z, yaw: h.car.yaw, kind: h.car.kind, tint: h.car.tint, damage: h.car.damage, wheelSpin: 0, quest: h.car.quest }); h.car = null; }
  h.x = -30; h.z = -94; h.y = 0; h.hp = 1; h.swim = false;
  showToast('BUSTED — the PBPD thanks you for the $150 donation', 4.5);
  say('PBPD DISPATCH', 'Suspect processed. The shoe sees all, friend.', 5);
  setStatus('Busted by the PBPD');
}
function wasted() {
  const h = G.hero;
  G.money = Math.max(0, G.money - 100);
  G.heat = 0; G.bust = 0; cops.length = 0;
  if (h.car) { parked.push({ x: h.car.x, z: h.car.z, yaw: h.car.yaw, kind: h.car.kind, tint: h.car.tint, damage: h.car.damage, wheelSpin: 0, quest: h.car.quest }); h.car = null; }
  h.x = WORLD.garage.x - 6; h.z = WORLD.garage.z + 15; h.y = 0; h.hp = 1; h.ar = 0.2; h.swim = false;
  showToast('WASTED — Marla paid your clinic bill ($100)', 4.5);
}

// ---------- hero & driving ----------
function updateHero(dt) {
  const h = G.hero;
  G.camYaw -= mouseDX * 0.0031;
  G.camPitch = clamp(G.camPitch + mouseDY * 0.0026, -0.06, 1.05);
  mouseDX = 0; mouseDY = 0;
  fireCooldown -= dt;
  heroRecoil = Math.max(0, heroRecoil - dt * 0.9);
  if (reloadT > 0) {
    reloadT -= dt;
    if (reloadT <= 0 && MAG[h.weapon]) {
      const need = MAG[h.weapon] - h.ammo[h.weapon], take = Math.min(need, h.reserve[h.weapon]);
      h.ammo[h.weapon] += take; h.reserve[h.weapon] -= take;
    }
  }
  if (h.car) { updateDriving(dt); return; }
  h.aiming = mouseDownR && !wheelOpen;
  const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
  const rx = -fz, rz = fx;
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) { mx += fx; mz += fz; }
  if (keys.KeyS || keys.ArrowDown) { mx -= fx; mz -= fz; }
  if (keys.KeyA || keys.ArrowLeft) { mx -= rx; mz -= rz; }
  if (keys.KeyD || keys.ArrowRight) { mx += rx; mz += rz; }
  const ml = Math.hypot(mx, mz);
  h.moving = ml > 0.1;
  const dep = waterDepth(h.x, h.z);
  const speed = h.swim ? 1.9 : dep > 0.25 ? 2.1 : ((keys.ShiftLeft || keys.ShiftRight) ? 5.8 : 3.3) * (h.aiming ? 0.45 : 1);
  if (h.moving) {
    mx /= ml; mz /= ml;
    h.yaw = h.aiming ? G.camYaw : angLerp(h.yaw, Math.atan2(mx, mz), dt * 11);
    const step = speed * dt;
    const nx = h.x + mx * step, nz = h.z + mz * step;
    if (waterDepth(nx, nz) > 0.3 || h.swim || !collide(nx, h.z, 0.45)) h.x = clamp(nx, WORLD.minX + 2, WORLD.maxX - 2);
    if (waterDepth(h.x, nz) > 0.3 || h.swim || !collide(h.x, nz, 0.45)) h.z = clamp(nz, WORLD.minZ + 2, WORLD.maxZ - 2);
    h.walk += dt * speed * (h.swim ? 2.1 : 3.2);
    if (h.swim) G.stats.swum += step;
  } else if (h.aiming) h.yaw = G.camYaw;
  const dep2 = waterDepth(h.x, h.z);
  if (!h.swim && dep2 > 0.95 && !inPier(h.x, h.z)) { h.swim = true; splashAt(h.x, h.z, 10); }
  if (h.swim && dep2 < 0.55 && !inPier(h.x, h.z)) h.swim = false;
  if (h.swim) {
    rippleT -= dt;
    if (rippleT <= 0 && h.moving) { ripples.push({ x: h.x, z: h.z, rad: 0.35, life: 1.5, max: 1.5 }); rippleT = 0.45; }
  }
  h.wet = h.swim ? 1 : Math.max(0, h.wet - dt * 0.04);
  const gy = groundTargetY();
  if (h.vy === 0 && h.y < gy) h.y = gy; // step up onto the pier / out of the water
  if (keys.Space && h.y <= gy + 0.02 && !h.swim && h.vy === 0) h.vy = 3.3;
  h.vy -= 11 * dt; h.y += h.vy * dt;
  if (h.y <= gy) { if (h.vy < -3.2 && dep2 > 0.9) splashAt(h.x, h.z, 8); h.y = gy; h.vy = 0; }
  if (mouseDownL && fireCooldown <= 0 && !wheelOpen) fire();
  if (simT - G.lastCrimeT > 10 && G.heat === 0) h.hp = clamp(h.hp + dt * 0.02, 0, 1);
  if (G.bust >= 1) busted();
  if (h.hp <= 0) wasted();
}
function hitWall(c) {
  if (Math.abs(c.speed) > 4) {
    c.damage = clamp(c.damage + Math.abs(c.speed) * 0.012, 0, 1);
    spark(c.x, 0.7, c.z, 5);
    if (audio.started) audio.shot('fists');
  }
  c.speed *= -0.22;
}
function updateDriving(dt) {
  const h = G.hero, c = h.car;
  const maxF = (c.kind === 'stock' ? 30 : c.kind === 'truck' ? 19 : 25) * (c.damage > 0.75 ? 0.5 : 1);
  if (keys.KeyW || keys.ArrowUp) c.speed += (c.speed < 0 ? 30 : 14) * dt;
  if (keys.KeyS || keys.ArrowDown) c.speed -= (c.speed > 0 ? 30 : 10) * dt;
  c.speed -= c.speed * 0.32 * dt;
  if (Math.abs(c.speed) < 0.04 && !keys.KeyW && !keys.KeyS) c.speed = 0;
  c.speed = clamp(c.speed, -9, Math.max(maxF, 0));
  const steer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
  if (steer) c.yaw += steer * 1.45 * Math.min(1, Math.abs(c.speed) / 6) * (keys.Space ? 1.7 : 1) * dt * (c.speed < 0 ? -1 : 1);
  if (keys.Space) c.speed -= c.speed * 1.6 * dt;
  const ox = c.x, oz = c.z;
  c.x += Math.sin(c.yaw) * c.speed * dt;
  if (collide(c.x, c.z, 1.25)) { c.x = ox; hitWall(c); }
  c.z += Math.cos(c.yaw) * c.speed * dt;
  if (collide(c.x, c.z, 1.25)) { c.z = oz; hitWall(c); }
  c.x = clamp(c.x, WORLD.minX + 3, WORLD.maxX - 3);
  c.z = clamp(c.z, WORLD.minZ + 3, WORLD.maxZ - 3);
  if (waterDepth(c.x, c.z) > 0.4) { c.speed -= c.speed * 3 * dt; c.damage = clamp(c.damage + dt * 0.05, 0, 1); }
  c.wheelSpin += c.speed * dt / 0.34;
  h.x = c.x; h.z = c.z; h.y = 0; h.yaw = c.yaw;
  G.camYaw = angLerp(G.camYaw, c.yaw, dt * 2.6);
  if (audio.started) { audio.updateMusic(dt, true); audio.engine(true, Math.abs(c.speed) / Math.max(maxF, 1)); }
  if (c.damage > 0.55 && R.chance(0.35)) particles.push({ kind: 'smoke', x: c.x + Math.sin(c.yaw) * 1.8, y: 1.1, z: c.z + Math.cos(c.yaw) * 1.8, vx: R.range(-0.2, 0.2), vy: R.range(0.8, 1.4), vz: R.range(-0.2, 0.2), life: 1.1, max: 1.1, rot: 0 });
  for (const p of peds) {
    if (p.state === 'down' || p.state === 'swim') continue;
    if (Math.abs(c.speed) > 5 && dist2(c.x, c.z, p.x, p.z) < 1.7) { knockDown(p); addHeat(0.6); c.speed *= 0.82; }
  }
}

// ---------- ghost drip, Sahur, particles ----------
function updateGhostAndSahur(dt) {
  const h = G.hero, gx = WORLD.ghost.x, gz = WORLD.ghost.z;
  billT -= dt;
  if (billT <= 0 && dist2(h.x, h.z, gx, gz) < 46) {
    particles.push({ kind: 'bill', x: gx + R.range(-0.4, 0.4), y: 1.25, z: gz + 0.5, vx: R.range(-0.5, 0.5), vy: R.range(0.5, 1.1), vz: R.range(0.2, 0.9), life: 2.4, max: 2.4, rot: R.range(0, 6) });
    billT = 0.4;
  }
  if (!h.car && dist2(h.x, h.z, gx, gz) < 7.5) {
    G.ghostDrip += dt;
    if (G.ghostDrip >= 2.2) { G.ghostDrip = 0; G.money += 4; G.stats.bills++; if (audio.started) audio.cash(); }
  } else G.ghostDrip = 0;
  const s = G.sahur;
  if (s.active) {
    s.t += dt;
    const tx = WORLD.sahurSpot.x + Math.cos(s.a) * 11, tz = WORLD.sahurSpot.z + Math.sin(s.a) * 8;
    if (dist2(s.x, s.z, tx, tz) < 1.6) s.a += 0.55;
    else {
      s.yaw = angLerp(s.yaw, Math.atan2(tx - s.x, tz - s.z), dt * 3);
      s.x += Math.sin(s.yaw) * 0.85 * dt; s.z += Math.cos(s.yaw) * 0.85 * dt;
    }
    if (s.t > 85 && G.jobIdx !== 4) s.active = false;
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.kind === 'casing' || p.kind === 'spark' || p.kind === 'splash') {
      p.vy -= (p.kind === 'splash' ? 6 : 9) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const gy = p.kind === 'splash' ? -0.3 : 0.05;
      if (p.y < gy) { p.y = gy; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      p.rot += dt * 7;
    } else if (p.kind === 'bill') {
      p.x += p.vx * dt + Math.sin(simT * 3 + p.rot) * dt * 0.4;
      p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * 0.25; p.rot += dt * 2.4;
      if (p.y < 0.06) { p.y = 0.06; p.vy = 0; }
    } else if (p.kind === 'smoke') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
  }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i];
    rp.life -= dt; rp.rad += dt * 1.5;
    if (rp.life <= 0) ripples.splice(i, 1);
  }
}
function computePrompt() {
  const h = G.hero;
  G.prompt = null;
  if (h.car) {
    if (h.car.damage > 0.02 && dist2(h.x, h.z, WORLD.garage.x, WORLD.garage.z + 13) < 11) G.prompt = 'E — Repair at the garage ($40)';
    return;
  }
  if (dist2(h.x, h.z, marla.x, marla.z) < 3.4) G.prompt = G.jobIdx >= 0 ? 'E — Talk to Marla' : 'E — Talk to Marla (new job)';
  else if (dist2(h.x, h.z, dre.x, dre.z) < 3.4) G.prompt = 'E — Talk to Dre';
  else if (!G.sahur.active && dist2(h.x, h.z, WORLD.sahurSpot.x, WORLD.sahurSpot.z) < 7) G.prompt = 'E — Summon the Sahur';
  else for (const c of parked) if (dist2(h.x, h.z, c.x, c.z) < 4.2) { G.prompt = 'F — Enter ' + (CAR_NAMES[c.kind] || 'car'); break; }
}
function update(dt) {
  G.time = (G.time + dt / 20) % 24;
  G.playtime += dt;
  updateHero(dt);
  updatePeds(dt);
  updateTraffic(dt);
  updatePolice(dt);
  updateJobs(dt);
  updateGhostAndSahur(dt);
  updateParticles(dt);
  const h = G.hero;
  if (simT - G.lastCrimeT > 6 && dist2(h.x, h.z, WORLD.hq.x, WORLD.hq.z) > 36) G.heat = clamp(G.heat - dt * 0.055, 0, 5);
  if (!G.hqBeatDone && dist2(h.x, h.z, WORLD.hq.x, WORLD.hq.z + 15) < 26) {
    G.hqBeatDone = true;
    say('PBPD DISPATCH', 'Nice try, bro. The shoe is a cop shop — welcome to PBPD headquarters.', 7);
    showToast('The shoe was a cop shop all along', 4);
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    if (dist2(h.x, h.z, pickups[i].x, pickups[i].z) < 1.8) {
      pickups.splice(i, 1); G.collectLeft--; G.money += 15; G.stats.bills++;
      if (audio.started) audio.cash();
      showToast('Bundle secured +$15', 1.8);
    }
  }
  computePrompt();
  saveT -= dt;
  if (saveT <= 0) { saveT = 20; if (G.jobIdx < 0) saveGame(); }
}

// ---------- rendering ----------
function computeCamera() {
  const h = G.hero;
  if (G.mode === 'title') {
    const a = simT * 0.045;
    return { pos: [Math.cos(a) * 48, 15, -146 + Math.sin(a) * 42], at: [2, 9, -180] };
  }
  if (h.car) {
    const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
    return { pos: [h.car.x - fx * 8.6, 3.4, h.car.z - fz * 8.6], at: [h.car.x + fx * 6, 1.7, h.car.z + fz * 6] };
  }
  const dist = h.aiming ? 3.2 : 5.4;
  const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
  const cp = Math.cos(G.camPitch), sp = Math.sin(G.camPitch);
  const side = h.aiming ? 0.85 : 0;
  const rx = -fz, rz = fx;
  const pos = [h.x - fx * dist * cp + rx * side, h.y + 1.7 + sp * dist, h.z - fz * dist * cp + rz * side];
  if (h.swim) pos[1] = Math.max(pos[1], 1.35);
  return { pos, at: [h.x + fx * 5 + rx * side * 0.5, h.y + 1.55 - sp * 1.2, h.z + fz * 5 + rz * side * 0.5] };
}
function render() {
  const ph = phaseAt(G.time), sun = sunState(G.time);
  renderer.sunDir = sun.dir;
  renderer.sunCol = [ph.sun[0] * ph.sunI, ph.sun[1] * ph.sunI, ph.sun[2] * ph.sunI];
  renderer.ambSky = ph.ambSky; renderer.ambGnd = ph.ambGnd; renderer.fogCol = ph.fog;
  const nf = clamp((0.62 - ph.sunI) / 0.4, 0, 1);
  renderer.fogNear = lerp(175, 100, nf);
  renderer.fogFar = lerp(560, 340, nf);
  const cam = computeCamera();
  G.camPos = cam.pos;
  const view = matLookAt(cam.pos, cam.at, [0, 1, 0]);
  const proj = matPerspective(1.02, glCanvas.width / glCanvas.height, 0.1, 950);
  renderer.beginFrame(view, proj);
  renderer.use('frame');
  drawSky(renderer, simT);
  drawWheel(renderer, T, simT);
  drawDynamic(nf);
  renderer.finishFrame();
}
function pedPose(p) {
  if (p.state === 'swim') return { swim: true, walk: p.walk };
  if (p.state === 'sit') return { sit: true, walk: 0 };
  if (p.state === 'down') return { walk: 0 };
  if (p.state === 'cheer') return { armsUp: true, walk: p.walk };
  if (p.state === 'bill') return { holdBill: true, walk: p.walk * 0.15 };
  if (p.state === 'film') return { phone: true, walk: 0 };
  if (p.state === 'queue') return { walk: 0, phone: !!p.app.phone };
  if (p.holdUp > 0) return { armsUp: true, walk: 0 };
  return { walk: p.walk, phone: !!p.app.phone && p.pauseT > 0.4, coffee: !!p.app.coffee };
}
function drawPed(p) {
  const r = renderer;
  const y = p.state === 'swim' ? -0.5 : 0;
  if (p.state !== 'swim' && p.state !== 'down') { r.push(); r.translate(p.x, 0.06, p.z); r.blobShadow(0.5, 0.5, 0.3); r.pop(); }
  r.push(); r.translate(p.x, y, p.z); r.rotateY(p.yaw);
  if (p.state === 'down') { r.translate(0, 0.14, 0); r.rotateX(-1.45); }
  drawPerson(r, T, p.app, pedPose(p));
  r.pop();
}
function drawDynamic(nf) {
  const r = renderer, h = G.hero;
  const night = nf > 0.25;
  if (night) for (const L of WORLD.lamps) {
    if (dist2(L.x, L.z, h.x, h.z) > 95) continue;
    r.push(); r.translate(L.x, 0.09, L.z); r.groundQuad(9, 9, T.glow, [1.15, 0.98, 0.66], 0.5 * nf); r.pop();
    r.push(); r.translate(L.x, 5.3, L.z); r.billboard(2.6, T.glow, [1.2, 1.05, 0.7], 0.5 * nf); r.pop();
  }
  for (const b of boats) {
    r.push(); r.translate(b.x, -0.18 + Math.sin(simT * 0.6 + b.ph) * 0.1, b.z); r.rotateY(b.yaw); r.rotateZ(Math.sin(simT * 0.5 + b.ph) * 0.02);
    drawVehicle(r, T, 'boat', { tint: b.tint }); r.pop();
  }
  for (const c of parked) {
    r.push(); r.translate(c.x, 0.06, c.z); r.blobShadow(1.3, 2.6, 0.34); r.pop();
    r.push(); r.translate(c.x, 0, c.z); r.rotateY(c.yaw); drawVehicle(r, T, c.kind, { tint: c.tint, wheelSpin: c.wheelSpin || 0 }); r.pop();
  }
  for (const c of cars) {
    const tr = trafficTransform(c);
    r.push(); r.translate(tr.x, 0.06, tr.z); r.blobShadow(1.3, 2.6, 0.34); r.pop();
    r.push(); r.translate(tr.x, 0, tr.z); r.rotateY(tr.yaw); drawVehicle(r, T, c.kind, { tint: c.tint, wheelSpin: c.wheelSpin }); r.pop();
    if (night) { r.push(); r.translate(tr.x + Math.sin(tr.yaw) * 4.4, 0.1, tr.z + Math.cos(tr.yaw) * 4.4); r.groundQuad(5.5, 7, T.glow, [1.1, 1.05, 0.85], 0.35 * nf); r.pop(); }
  }
  for (const c of cops) {
    r.push(); r.translate(c.x, 0.06, c.z); r.blobShadow(1.3, 2.6, 0.34); r.pop();
    r.push(); r.translate(c.x, 0, c.z); r.rotateY(c.yaw); drawVehicle(r, T, 'cop', { tint: [0.93, 0.94, 0.96], wheelSpin: c.wheelSpin, lightPhase: Math.floor(simT * 2.4 + (c.lightSeed || 0)) % 2 }); r.pop();
  }
  r.push(); r.translate(WORLD.ghost.x, 0, WORLD.ghost.z); drawGhost(r, T, simT); r.pop();
  r.push(); r.translate(WORLD.ghost.x, 1.25, WORLD.ghost.z + 0.55); r.billboard(2.2 + Math.sin(simT * 2.4) * 0.25, T.glow, [0.95, 0.35, 0.62], 0.26); r.pop();
  for (const p of peds) drawPed(p);
  r.push(); r.translate(marla.x, 0.06, marla.z); r.blobShadow(0.55, 0.55, 0.32); r.pop();
  r.push(); r.translate(marla.x, 0, marla.z); r.rotateY(marla.yaw); drawPerson(r, T, marla.app, { walk: 0 }); r.pop();
  r.push(); r.translate(dre.x, 0.06, dre.z); r.blobShadow(0.55, 0.55, 0.32); r.pop();
  r.push(); r.translate(dre.x, 0, dre.z); r.rotateY(dre.yaw); drawPerson(r, T, dre.app, { walk: 0 }); r.pop();
  if (G.sahur.active) {
    r.push(); r.translate(G.sahur.x, 0.07, G.sahur.z); r.blobShadow(2.7, 2.7, 0.4); r.pop();
    r.push(); r.translate(G.sahur.x, 0, G.sahur.z); r.rotateY(G.sahur.yaw || 0); drawSahur(r, T, simT); r.pop();
  }
  if (h.car) {
    const c = h.car;
    r.push(); r.translate(c.x, 0.06, c.z); r.blobShadow(1.35, 2.7, 0.36); r.pop();
    r.push(); r.translate(c.x, 0, c.z); r.rotateY(c.yaw); drawVehicle(r, T, c.kind, { tint: c.tint, wheelSpin: c.wheelSpin }); r.pop();
    if (night) { r.push(); r.translate(c.x + Math.sin(c.yaw) * 4.6, 0.1, c.z + Math.cos(c.yaw) * 4.6); r.groundQuad(6, 7.5, T.glow, [1.1, 1.05, 0.85], 0.4 * nf); r.pop(); }
  } else {
    if (!h.swim) { r.push(); r.translate(h.x, h.y + 0.06, h.z); r.blobShadow(0.55, 0.55, 0.34); r.pop(); }
    r.push(); r.translate(h.x, h.y, h.z); r.rotateY(h.yaw);
    drawPerson(r, T, HERO_APPEARANCE, { walk: h.walk, aim: h.aiming, carry: true, weapon: h.weapon, swim: h.swim, aimPitch: h.aiming ? -G.camPitch * 0.45 - heroRecoil : 0 });
    r.pop();
  }
  if (heli.active) {
    // PBPD air unit: full helicopter model, rotors spinning, searchlight at night
    r.push(); r.translate(heli.x, heli.y, heli.z); r.rotateY(heli.yaw);
    drawHelicopter(r, T, { spin: simT * 26, tailSpin: simT * 43, light: night, blink: Math.floor(simT * 1.6) % 2 === 0 });
    r.pop();
    if (night) {
      r.push(); r.translate(h.x, 0.12, h.z); r.groundQuad(12, 12, T.glow, [1.1, 1.05, 0.9], 0.5); r.pop();
      r.push(); r.translate(heli.x, heli.y - 1.2, heli.z); r.billboard(6, T.glow, [1.1, 1.05, 0.9], 0.35); r.pop();
    }
  } else if (WORLD.hqPad) {
    // between callouts the air unit sits on the HQ roof pad, rotors idling
    r.push(); r.translate(WORLD.hqPad.x, WORLD.hqPad.y + 1.15, WORLD.hqPad.z); r.rotateY(2.2);
    drawHelicopter(r, T, { spin: simT * 1.5, tailSpin: simT * 4 });
    r.pop();
  }
  // ambient air traffic: two helicopters crossing the sky on long legs
  for (const A of [{ sp: 13, y: 88, z: -150, ph: 0 }, { sp: -10.5, y: 104, z: 70, ph: 400 }]) {
    const ax = ((simT * A.sp + A.ph + 560) % 1120) - 560, az = A.z + Math.sin(simT * 0.05 + A.ph) * 26;
    r.push(); r.translate(ax, A.y + Math.sin(simT * 0.4 + A.ph) * 1.5, az); r.rotateY(A.sp > 0 ? Math.PI / 2 : -Math.PI / 2);
    drawHelicopter(r, T, { spin: simT * 24, tailSpin: simT * 40, body: [0.55, 0.5, 0.45], livery: false, blink: Math.floor(simT * 1.6 + A.ph) % 2 === 0 });
    r.pop();
  }
  { // sun / moon glint: a bright path across the water toward the light's azimuth
    const sst = sunState(G.time), sd = sst.dir;
    const glintA = sst.up ? clamp(1.05 - Math.abs(sd[1]) * 2.3, 0, 0.5) : 0.32;
    if (glintA > 0.03) {
      const gc = sst.up ? [1.25, 0.85, 0.45] : [0.65, 0.75, 1.0];
      for (let i = 0; i < 3; i++) {
        const d = 26 + i * 30, gx = h.x + sd[0] * d, gz = h.z + sd[2] * d;
        if (gz > WORLD.shoreZ - 4) continue;
        r.push(); r.translate(gx, -0.28, gz); r.groundQuad(7 + i * 5, 16 + i * 8, T.glow, gc, glintA * (1 - i * 0.22)); r.pop();
      }
    }
  }
  const tgt = stageTarget();
  if (tgt && G.mode === 'play') {
    r.push(); r.translate(tgt.x, 15, tgt.z); r.cylinder(0.55, 30, 8, { tile: T.white }, [0.91, 0.24, 0.55], 0.3); r.pop();
    r.push(); r.translate(tgt.x, 0.6, tgt.z); r.billboard(3.2, T.glow, [0.95, 0.35, 0.62], 0.4); r.pop();
  }
  for (const p of pickups) {
    r.push(); r.translate(p.x, 0.55 + Math.sin(simT * 2.2 + p.ph) * 0.14, p.z); r.rotateY(simT * 1.4 + p.ph); r.box(0.52, 0.36, 0.52, { tile: T.bill }); r.pop();
    r.push(); r.translate(p.x, 1.15, p.z); r.billboard(1.5, T.glow, [0.6, 0.85, 0.5], 0.35); r.pop();
  }
  for (const rp of ripples) {
    r.push(); r.translate(rp.x, -0.3, rp.z); r.cylinder(rp.rad, 0.05, 18, { tile: T.foam }, [0.92, 0.98, 1.0], 0.1 * clamp(rp.life / rp.max, 0, 1)); r.pop();
  }
  for (const p of particles) {
    if (p.kind === 'flash') { r.push(); r.translate(p.x, p.y, p.z); r.billboard(1.5, T.glow, [1.4, 1.1, 0.6], 0.85); r.pop(); }
    else if (p.kind === 'bill') { r.push(); r.translate(p.x, p.y, p.z); r.rotateY(p.rot); r.rotateX(p.rot * 0.6); r.box(0.19, 0.095, 0.008, { tile: T.bill }); r.pop(); }
    else if (p.kind === 'casing') { r.push(); r.translate(p.x, p.y, p.z); r.rotateZ(p.rot); r.box(0.03, 0.05, 0.03, { tile: T.brass }, [1.2, 1.0, 0.5]); r.pop(); }
    else if (p.kind === 'spark') { r.push(); r.translate(p.x, p.y, p.z); r.billboard(0.3, T.glow, [1.4, 1.15, 0.6], 0.8); r.pop(); }
    else if (p.kind === 'splash') { r.push(); r.translate(p.x, p.y, p.z); r.box(0.07, 0.12, 0.07, { tile: T.white }, [0.9, 0.96, 1.0]); r.pop(); }
    else if (p.kind === 'smoke') { r.push(); r.translate(p.x, p.y, p.z); r.billboard(0.8 + (1 - p.life / p.max) * 1.6, T.glow, [0.32, 0.32, 0.34], 0.22 * clamp(p.life / p.max, 0, 1)); r.pop(); }
  }
  if (G.mode !== 'shot') for (const m of motes) {
    r.push(); r.translate(h.x + m[0] + Math.sin(simT * 0.4 + m[3]) * 0.6, m[1] + Math.sin(simT * 0.7 + m[3] * 2) * 0.2, h.z + m[2]);
    r.billboard(0.13, T.glow, [1, 0.95, 0.8], 0.1); r.pop();
  }
}

// ---------- HUD state ----------
function stageObjective() {
  if (G.jobIdx < 0) return '';
  const st = JOBS[G.jobIdx].stages[G.stageIdx];
  switch (st.kind) {
    case 'go': return 'Reach the marker';
    case 'stand': return `Hold the spot — ${Math.max(0, st.t - G.standT).toFixed(0)}s`;
    case 'collect': return `Collect the bundles — ${G.collectLeft} left`;
    case 'steal': return 'Take the No.7 stock car';
    case 'drive': return 'Drive to the checkpoint';
    case 'escape': return G.heat > 0.05 ? 'Lose the PBPD heat first' : 'Reach the marker';
    case 'summon': return 'Summon the Sahur — press E at the stones';
    case 'follow': return `Walk with the Sahur — ${Math.max(0, st.t - G.followT).toFixed(0)}s`;
  }
  return '';
}
function hudState() {
  const h = G.hero;
  const district = districtAt(h.x, h.z);
  const job = G.jobIdx >= 0 ? JOBS[G.jobIdx] : null;
  return {
    mission: job ? { title: job.title, objective: stageObjective() } : null,
    clock: fmtClock(G.time), phase: phaseName(G.time),
    money: G.money, stars: stars(), bust: G.bust,
    rankName: rankFor(G.rp), rp: G.rp,
    hp: h.hp, ar: h.ar,
    crew: h.car ? 'DRE · riding shotgun' : (G.heat > 0.4 ? 'DRE · decoy ready — press G' : 'DRE · wheelman on standby'),
    weapon: h.weapon, ammo: h.ammo[h.weapon], reserve: h.reserve[h.weapon],
    dialogue: G.dialogue && simT < G.dialogue.until ? G.dialogue : null,
    driving: h.car ? CAR_NAMES[h.car.kind] : null,
    speed: h.car ? Math.abs(h.car.speed) * 3.6 : 0,
    damage: h.car ? h.car.damage : 0,
    radio: audio.started ? audio.trackName() : STATIONS[G.radioIdx].name + ' · ' + STATIONS[G.radioIdx].tracks[0],
    prompt: G.prompt, toast: G.toast && simT < G.toast.until ? G.toast.text : null,
    crosshair: h.aiming && !h.car,
    player: { x: h.x, z: h.z, yaw: h.car ? h.car.yaw : h.yaw },
    street: streetAt(h.x, h.z), district, standing: G.standing[district] ?? 1,
    target: stageTarget(), waypoint: G.waypoint,
    wheelSel: G.wheelSel, ammoOf: { fists: 0, ...h.ammo }, reserveOf: { fists: 0, ...h.reserve },
    jobs: JOBS.map((j, i) => ({ title: j.title, blurb: j.blurb, done: i < G.jobsDone, active: i === G.jobIdx })),
    jobsDone: G.jobsDone, stats: G.stats, playtime: fmtPlay(G.playtime), tab: G.tab,
  };
}

// ---------- deterministic screenshot staging ----------
function stageShot(name) {
  const h = G.hero;
  simT = 12.35;
  G.mode = 'shot';
  if (name === 'cover') {
    G.time = 17.55;
    // On-pier composition: the hero stands ON the deck (y = deckY) aiming
    // north at the wheel. From the sand (eye ~2.7 m) the sea was a sliver
    // squeezed to the frame's top edge behind the HUD; from the deck the
    // water flanks the planks on both sides for the pier's whole length.
    // The roadblock cars/officers are drawn at ground level and cannot
    // stand on the deck, so the standoff is told by the wanted stars, the
    // bust bar and the PBPD helicopter over the water instead.
    h.x = 2; h.z = -140; h.y = WORLD.pier.deckY; h.yaw = Math.atan2(2 - h.x, -182 - h.z);
    h.weapon = 'shotgun'; h.ammo.shotgun = 5; h.aiming = true; h.hp = 0.85; h.ar = 0.4;
    G.camYaw = h.yaw - 0.92; G.camPitch = 0.15;
    G.jobIdx = 0; G.stageIdx = 1; G.heat = 2.6; G.bust = 0.35; G.money = 480; G.rp = 170;
    G.dialogue = { who: 'MARLA VOSS', line: 'That is it. Let them see the shotgun. Politely.', until: Infinity };
    heli.active = true; heli.x = 26; heli.z = -168; heli.yaw = 2.4;
  } else if (name === 'wheel') {
    G.time = 11.2;
    h.x = 16; h.z = 44; h.yaw = Math.PI; h.weapon = 'rifle'; h.aiming = true; // aiming: closer shoulder camera, so the hero reads lit and large under the wheel, rifle up
    G.camYaw = Math.PI; G.camPitch = 0.4;
    wheelOpen = true; G.wheelSel = 4;
    G.money = 860; G.rp = 240;
  } else if (name === 'ghost') {
    G.time = 18.9;
    const gx = WORLD.ghost.x, gz = WORLD.ghost.z;
    // Camera in close over the hero's shoulder: from the old spot (+9.5,+7.5)
    // the ghost shrank to a pinkish smudge in the middle distance; at this
    // range the white figure, its star coin and the crowd ring all read.
    h.x = gx + 4.6; h.z = gz + 3.4; h.yaw = Math.atan2(gx - h.x, gz - h.z); h.weapon = 'smg'; h.walk = 1.2;
    G.camYaw = h.yaw + 0.15; G.camPitch = 0.26;
    G.money = 720; G.rp = 220;
    G.toast = { text: 'MAKE.FUN DAILY DROP — stand in the ring', until: Infinity };
    for (let i = 0; i < 12; i++) particles.push({ kind: 'bill', x: gx + Math.sin(i * 2.3) * 1.3, y: 1 + (i % 5) * 0.38, z: gz + 0.6 + Math.cos(i * 1.7) * 0.9, vx: 0, vy: 0, vz: 0, life: 99, max: 99, rot: i * 0.7 });
  } else if (name === 'swim') {
    G.time = 21.6;
    h.x = 20; h.z = -150; h.swim = true; h.y = -0.84; h.walk = 2.1;
    h.yaw = Math.atan2(2 - h.x, -182 - h.z);
    // Three-quarter back-side camera: dead astern, the prone body foreshortens
    // into a vertical blob; from this angle its horizontal length, the crawl
    // stroke and the trailing kick all read at a glance, with the lit pier
    // across the background. (h.y sits his back on the water plane, y=-0.4;
    // he stays east of the pier — at the deck edge the camera ends up over
    // the deck and he slips out of frame entirely.)
    G.camYaw = h.yaw - 0.7; G.camPitch = 0.3;
    G.money = 540; G.rp = 190;
    ripples.push({ x: h.x, z: h.z, rad: 1.1, life: 99, max: 99 });
    ripples.push({ x: h.x + 0.8, z: h.z + 0.6, rad: 1.9, life: 99, max: 99 });
    ripples.push({ x: h.x - 0.7, z: h.z - 0.5, rad: 2.6, life: 99, max: 99 });
  }
}

// ---------- main loop ----------
if (SHOT) stageShot(SHOT);
let shotFrames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000 || 0.016));
  lastNow = now;
  if (G.mode === 'shot') {
    render(); // every frame: a frozen canvas can be captured mid-clear (black) by screenshot tooling
    const S = hudState();
    hud.drawHUD(S);
    if (wheelOpen) hud.drawWheel(S);
    if (++shotFrames === 5) { window.__shotReady = true; document.title = 'SHOT READY'; }
    return;
  }
  if (G.mode === 'title') {
    simT += dt;
    updatePeds(dt); updateTraffic(dt); updateGhostAndSahur(dt); updateParticles(dt);
    render();
    hud.drawTitle({ hasSave: hasSave() });
    return;
  }
  if (!paused && !wheelOpen) { simT += dt; update(dt); }
  render();
  const S = hudState();
  hud.drawHUD(S);
  if (wheelOpen) hud.drawWheel(S);
  if (paused) hud.drawPause(S);
}
requestAnimationFrame(frame);
