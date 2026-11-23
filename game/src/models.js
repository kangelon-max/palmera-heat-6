// 3D models built from shaded boxes/prisms/cylinders: people with realistic
// proportions (head ~1/7 of height, jointed arms/legs, faces, hair, cloth),
// vehicles with liveries and lit details, firearms assembled from named parts,
// the make.fun ghost, and the giant wooden Tung Sahur.
import { matTranslate, matRotY } from './gl.js';

const SKIN_TINTS = [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]];
const HAIR_COLORS = [[0.16, 0.11, 0.07], [0.3, 0.2, 0.1], [0.55, 0.38, 0.18], [0.08, 0.08, 0.09], [0.45, 0.45, 0.47], [0.62, 0.3, 0.16]];
export const SHIRT_TILES = ['clothStripe', 'clothCheck', 'clothFloral', 'clothPlain', 'clothDenim', 'clothDark'];
export const SHIRT_TINTS = [[0.85, 0.8, 0.72], [0.6, 0.68, 0.78], [0.78, 0.55, 0.45], [0.55, 0.65, 0.5], [0.8, 0.75, 0.6], [0.5, 0.55, 0.7], [0.72, 0.62, 0.55], [0.45, 0.5, 0.55]];
export const PANTS_TINTS = [[0.32, 0.36, 0.44], [0.25, 0.24, 0.26], [0.45, 0.4, 0.33], [0.55, 0.48, 0.38], [0.3, 0.42, 0.4], [0.62, 0.58, 0.5]];

/** A box hanging from the current pivot, extending down -Y by len. */
function limb(r, len, w, d, mat, tint) {
  r.push(); r.translate(0, -len / 2, 0); r.box(w, len, d, mat, tint); r.pop();
}

/**
 * Draw a person at the current transform (feet at origin, facing +Z).
 * o: {skin, shades, hair, hairTint, shirt, shirtTint, pantsTint, shorts, shoes}
 * pose: {walk (phase radians), aim, carry, armsUp, phone, swim, sit, lean, weapon, aimPitch}
 */
export function drawPerson(r, T, o, pose = {}) {
  const skin = T[`skin${o.skin}`];
  const face = T[`face${o.skin}${o.shades ? 's' : ''}`];
  const shirtM = { tile: T[o.shirt] };
  const hairM = { tile: T.hairTile };
  const pantsM = { tile: T.clothPlain };
  const walk = pose.walk || 0;
  const swing = Math.sin(walk) * (pose.swim ? 0.25 : 0.55);
  const bob = pose.swim ? 0 : Math.abs(Math.sin(walk)) * 0.045;

  r.push();
  // Swim: pitch the whole body flat (1.5 rad) and lift it so the back, shoulders
  // and head ride ON the surface instead of sinking under the opaque water —
  // a swimmer reads by the body lying horizontal with one arm mid-recovery.
  if (pose.swim) { r.translate(0, 0.44, 0); r.rotateX(1.5); }
  r.translate(0, bob, 0);

  // ---- legs ----
  for (const side of [-1, 1]) {
    r.push();
    r.translate(side * 0.105, 0.98, 0);
    if (pose.sit) r.rotateX(-1.5);
    else if (pose.swim) r.rotateX(Math.sin(walk + (side > 0 ? Math.PI : 0)) * 0.5); // flutter kick
    else r.rotateX(swing * (side > 0 ? 1 : -1));
    limb(r, 0.48, 0.145, 0.16, pantsM, o.pantsTint);
    r.translate(0, -0.48, 0);
    if (pose.sit) r.rotateX(1.5);
    else if (!pose.swim) r.rotateX(Math.max(0, -Math.sin(walk + (side > 0 ? 0 : Math.PI))) * 0.5);
    if (o.shorts) limb(r, 0.44, 0.115, 0.125, { tile: skin }, SKIN_TINTS[o.skin]);
    else limb(r, 0.44, 0.125, 0.135, pantsM, o.pantsTint);
    r.translate(0, -0.44, 0.02);
    r.box(0.11, 0.07, 0.24, { tile: T.white }, o.shoeTint || [0.2, 0.19, 0.2]); // shoe
    r.pop();
  }

  // ---- torso ----
  r.push();
  r.translate(0, 0.98, 0);
  if (pose.lean) r.rotateX(pose.lean);
  r.push(); r.translate(0, 0.27, 0); r.box(0.44, 0.56, 0.24, shirtM, o.shirtTint); r.pop(); // chest
  r.push(); r.translate(0, 0.52, 0); r.box(0.45, 0.07, 0.25, shirtM, o.shirtTint); r.pop(); // shoulders
  r.push(); r.translate(0, 0.02, 0); r.box(0.4, 0.06, 0.22, { tile: T.white }, [0.16, 0.13, 0.1]); r.pop(); // belt

  // ---- arms + weapon ----
  const aim = pose.aim, carry = pose.carry && pose.weapon && !pose.swim; // a swimmer's arms crawl-stroke; the weapon stays holstered
  for (const side of [-1, 1]) {
    r.push();
    r.translate(side * 0.27, 0.5, 0);
    if (pose.armsUp) { r.rotateZ(side * -2.6); r.rotateX(Math.sin(walk * 0.5 + side) * 0.14); }
    else if (aim) { r.rotateX(-1.32 + (pose.aimPitch || 0)); r.rotateY(side * -0.16); }
    else if (carry) { r.rotateX(side > 0 ? -0.62 : -0.95); r.rotateZ(side * 0.18); }
    else if (pose.phone && side > 0) { r.rotateX(-0.5); }
    else if (pose.swim) { r.rotateX(Math.sin(walk + (side > 0 ? 0 : Math.PI)) * 1.55); } // crawl stroke: one arm recovers over the water, the other pulls
    else if (pose.holdBill) { r.rotateX(-1.15); }
    else r.rotateX(-swing * (side > 0 ? 1 : -1) * 0.9);
    limb(r, 0.3, 0.105, 0.115, shirtM, o.shirtTint); // upper arm (sleeve)
    r.translate(0, -0.3, 0);
    if (aim) r.rotateX(-0.12);
    else if (carry) r.rotateX(side > 0 ? -0.5 : -0.25);
    else if (pose.phone && side > 0) r.rotateX(-1.85);
    else if (pose.armsUp) r.rotateX(-0.15);
    else r.rotateX(-0.22);
    limb(r, 0.27, 0.09, 0.095, { tile: skin }, SKIN_TINTS[o.skin]); // forearm
    r.translate(0, -0.27, 0);
    r.box(0.085, 0.1, 0.09, { tile: skin }, SKIN_TINTS[o.skin]); // hand
    if (pose.phone && side > 0) {
      r.push(); r.translate(0, -0.06, 0.07); r.box(0.07, 0.13, 0.015, { tile: T.white }, [0.1, 0.1, 0.12]);
      r.translate(0, 0, 0.01); r.box(0.06, 0.11, 0.006, { tile: T.white }, [1.4, 1.5, 1.6]); r.pop(); // lit screen
    }
    if (pose.holdBill && side > 0) {
      r.push(); r.translate(0, -0.1, 0.05); r.rotateX(0.4); r.box(0.17, 0.085, 0.008, { tile: T.bill }); r.pop();
    }
    if (pose.coffee && side < 0) {
      r.push(); r.translate(0, -0.05, 0.03); r.box(0.07, 0.11, 0.07, { tile: T.white }, [0.92, 0.9, 0.86]); r.pop();
    }
    r.pop();
  }
  if (pose.weapon && (aim || carry)) {
    r.push();
    if (aim) { r.translate(0.13, 0.5, 0.4); r.rotateX(pose.aimPitch || 0); r.rotateY(-0.05); }
    else { r.translate(0.14, 0.3, 0.26); r.rotateY(0.5); r.rotateX(-0.12); }
    drawWeapon(r, T, pose.weapon);
    r.pop();
  }
  if (o.bag) { // shoulder bag
    r.push(); r.translate(-0.28, 0.34, 0.02); r.rotateZ(0.1); r.box(0.1, 0.26, 0.2, { tile: T.clothDark }, [0.4, 0.32, 0.24]); r.pop();
  }

  // ---- head ----
  r.push();
  r.translate(0, 0.56, 0);
  r.push(); r.translate(0, 0.045, 0); r.box(0.13, 0.09, 0.13, { tile: skin }, SKIN_TINTS[o.skin]); r.pop(); // neck
  r.translate(0, 0.21, 0);
  const headMat = { front: face, back: T.hairTile, left: skin, right: skin, top: T.hairTile, bottom: skin };
  r.box(0.235, 0.29, 0.25, headMat, SKIN_TINTS[o.skin]);
  // hair styles
  const hc = o.hairTint || HAIR_COLORS[0];
  if (o.hair === 'cap') { r.push(); r.translate(0, 0.1, 0); r.box(0.25, 0.09, 0.27, { tile: T.clothPlain }, o.capTint || [0.5, 0.2, 0.16]); r.translate(0, -0.03, 0.17); r.box(0.24, 0.03, 0.12, { tile: T.clothPlain }, o.capTint || [0.5, 0.2, 0.16]); r.pop(); }
  else if (o.hair === 'long') { r.push(); r.translate(0, -0.05, -0.045); r.box(0.26, 0.42, 0.2, hairM, hc); r.pop(); }
  else if (o.hair === 'mohawk') { r.push(); r.translate(0, 0.17, 0); r.box(0.07, 0.13, 0.27, hairM, hc); r.pop(); }
  else if (o.hair === 'bun') { r.push(); r.translate(0, 0.16, -0.06); r.box(0.13, 0.11, 0.13, hairM, hc); r.translate(0, -0.1, 0.04); r.box(0.25, 0.06, 0.26, hairM, hc); r.pop(); }
  else if (o.hair === 'hat') { r.push(); r.translate(0, 0.12, 0); r.cylinder(0.19, 0.035, 10, { tile: T.clothPlain }, [0.76, 0.68, 0.5]); r.translate(0, 0.03, 0); r.box(0.2, 0.1, 0.2, { tile: T.clothPlain }, [0.76, 0.68, 0.5]); r.pop(); }
  else if (o.hair !== 'bald') { r.push(); r.translate(0, 0.125, -0.012); r.box(0.245, 0.075, 0.26, hairM, hc); r.pop(); } // flat crop
  if (o.sunOnHead) { // hero's sunglasses resting on the head
    r.push(); r.translate(0, 0.155, 0.1); r.rotateX(-0.5); r.box(0.2, 0.045, 0.02, { tile: T.white }, [0.08, 0.08, 0.1]); r.pop();
  }
  r.pop(); // head
  r.pop(); // torso
  r.pop(); // root
}

/** Random-but-seeded pedestrian appearance from a stream. */
export function pedAppearance(R) {
  return {
    skin: R.int(0, 4),
    shades: R.chance(0.3),
    hair: R.pick(['flat', 'cap', 'long', 'mohawk', 'bun', 'hat', 'bald']),
    hairTint: R.pick(HAIR_COLORS),
    shirt: R.pick(SHIRT_TILES),
    shirtTint: R.pick(SHIRT_TINTS),
    pantsTint: R.pick(PANTS_TINTS),
    shorts: R.chance(0.4),
    bag: R.chance(0.22),
    coffee: R.chance(0.14),
    phone: R.chance(0.16),
  };
}
export const HERO_APPEARANCE = {
  skin: 1, shades: true, hair: 'flat', hairTint: HAIR_COLORS[0], shirt: 'clothFloral',
  shirtTint: [1.1, 0.78, 0.58], pantsTint: [0.8, 0.77, 0.7], shorts: true, sunOnHead: true,
  shoeTint: [0.9, 0.87, 0.83],
};

/**
 * Helicopter (local frame: nose toward +Z, skids bottom at y -1.15, main rotor
 * hub at y +1.52). o: {spin, tailSpin, body tint, livery (PBPD flank boards),
 * light (searchlight glow on), blink (tail strobe on)}.
 */
export function drawHelicopter(r, T, o = {}) {
  const spin = o.spin || 0, body = o.body || [0.9, 0.91, 0.93], dark = [0.16, 0.17, 0.19];
  const metal = { tile: T.gunMetal };
  // skids + struts
  for (const sx of [-0.85, 0.85]) {
    r.push(); r.translate(sx, -1.12, 0.15); r.rotateX(Math.PI / 2); r.cylinder(0.06, 3.6, 6, metal, [0.35, 0.36, 0.38]); r.pop();
    for (const sz of [-0.9, 1.1]) { r.push(); r.translate(sx * 0.82, -0.82, sz); r.rotateZ(sx * 0.5); r.box(0.07, 0.62, 0.07, metal, [0.35, 0.36, 0.38]); r.pop(); }
  }
  // fuselage: belly pan + glasshouse cabin (glass front and sides, solid roof)
  r.push(); r.translate(0, -0.28, 0); r.box(1.7, 0.62, 3.5, { tile: T.white }, body); r.pop();
  const cabinM = { front: T.carGlass, back: T.white, left: T.carGlass, right: T.carGlass, top: T.white, bottom: T.white };
  r.push(); r.translate(0, 0.42, 0.45); r.box(1.62, 0.95, 2.3, cabinM, body); r.pop();
  r.push(); r.translate(0, -0.02, 1.98); r.rotateX(0.5); r.box(1.5, 0.72, 0.5, { tile: T.white }, body); r.pop(); // sloped nose
  if (o.livery !== false) for (const sx of [-1, 1]) { r.push(); r.translate(sx * 0.87, -0.2, 0.1); r.rotateY(sx * Math.PI / 2); r.plane(2.6, 0.5, T.pbpdSide, [1, 1, 1], 0.1); r.pop(); }
  // engine deck, exhausts, mast
  r.push(); r.translate(0, 1.02, -0.5); r.box(1.15, 0.34, 1.5, metal, [0.3, 0.31, 0.34]); r.pop();
  for (const sx of [-1, 1]) { r.push(); r.translate(sx * 0.62, 0.98, -1.05); r.box(0.22, 0.2, 0.6, metal, dark); r.pop(); }
  r.push(); r.translate(0, 1.32, -0.35); r.cylinder(0.09, 0.34, 6, metal, dark); r.pop();
  // main rotor: four blades on a hub, spinning about Y
  r.push(); r.translate(0, 1.52, -0.35); r.rotateY(spin);
  r.box(7.8, 0.05, 0.34, metal, dark); r.box(0.34, 0.05, 7.8, metal, dark);
  r.push(); r.rotateX(Math.PI / 2); r.cylinder(0.2, 0.22, 8, metal, [0.4, 0.4, 0.42]); r.pop();
  r.pop();
  // tail boom, vertical fin, stabilizer, spinning tail rotor
  r.push(); r.translate(0, 0.28, -3.1); r.box(0.46, 0.5, 3.4, { tile: T.white }, body); r.pop();
  r.push(); r.translate(0, 0.62, -4.75); r.box(0.14, 1.15, 0.85, { tile: T.white }, body); r.pop();
  r.push(); r.translate(0, 0.42, -4.35); r.box(1.7, 0.07, 0.5, { tile: T.white }, body); r.pop();
  r.push(); r.translate(0.14, 0.66, -4.8); r.rotateX(o.tailSpin || spin * 2.6);
  r.box(0.05, 1.45, 0.15, metal, dark); r.box(0.05, 0.15, 1.45, metal, dark); r.pop();
  // searchlight pod under the nose + tail strobe
  r.push(); r.translate(0.45, -0.66, 1.55); r.cylinder(0.13, 0.24, 8, metal, dark); r.pop();
  if (o.light) { r.push(); r.translate(0.45, -0.86, 1.55); r.billboard(2.4, T.glow, [1.25, 1.15, 0.85], 0.75); r.pop(); }
  if (o.blink) { r.push(); r.translate(0, 0.3, -5.25); r.billboard(1.1, T.glow, [1.3, 0.25, 0.2], 0.85); r.pop(); }
}

// ---------------- firearms (local frame: grip at origin, barrel toward +Z) ----------------
export function drawWeapon(r, T, kind) {
  const metal = { tile: T.gunMetal }, grip = { tile: T.gunGrip }, wood = { tile: T.wood }, dark = { tile: T.white };
  const dt = [0.12, 0.12, 0.13];
  if (kind === 'pistol') {
    r.push();
    r.box(0.045, 0.075, 0.21, metal); // slide
    r.translate(0, -0.015, 0.115); r.box(0.03, 0.03, 0.035, metal, dt); // muzzle
    r.translate(0, 0.055, -0.225); r.box(0.012, 0.03, 0.012, metal, dt); // rear sight
    r.translate(0, 0.005, 0.19); r.box(0.01, 0.022, 0.01, { tile: T.white }, [1.6, 1.6, 1.6]); // front dot
    r.translate(0, -0.1, -0.03); r.rotateX(0.22); r.box(0.042, 0.13, 0.075, grip); // grip
    r.translate(0, -0.075, 0.004); r.box(0.046, 0.02, 0.08, metal, dt); // magazine base
    r.pop();
    r.push(); r.translate(0, -0.045, 0.055); r.box(0.008, 0.035, 0.008, metal, dt); r.pop(); // trigger hint
  } else if (kind === 'smg') {
    r.push();
    r.box(0.055, 0.1, 0.34, metal); // receiver
    r.translate(0, 0.005, 0.24); r.box(0.05, 0.07, 0.14, grip); // handguard
    r.translate(0, 0, 0.12); r.rotateX(Math.PI / 2); r.cylinder(0.026, 0.1, 8, metal, dt); r.pop();
    r.push(); r.translate(0, 0.005, 0.47); r.rotateX(Math.PI / 2); r.cylinder(0.027, 0.1, 8, metal, dt); r.pop(); // suppressor
    r.push(); r.translate(0, 0.01, -0.22); r.box(0.04, 0.06, 0.12, metal, dt); r.pop(); // folding stock
    r.push(); r.translate(0, -0.13, 0.03); r.rotateX(0.06); r.box(0.038, 0.17, 0.06, metal, [0.2, 0.2, 0.22]); r.pop(); // straight mag
    r.push(); r.translate(0, -0.075, -0.06); r.rotateX(0.25); r.box(0.04, 0.11, 0.06, grip); r.pop(); // grip
    r.push(); r.translate(0, 0.075, 0.05); r.box(0.014, 0.03, 0.05, metal, dt); r.translate(0, 0.004, 0.1); r.box(0.01, 0.02, 0.01, { tile: T.white }, [1.6, 1.6, 1.6]); r.pop(); // sights
  } else if (kind === 'shotgun') {
    r.push();
    r.box(0.06, 0.1, 0.3, metal); // receiver
    r.translate(0, 0.012, 0.32); r.rotateX(Math.PI / 2); r.cylinder(0.021, 0.42, 9, metal); r.pop(); // barrel
    r.push(); r.translate(0, -0.028, 0.3); r.rotateX(Math.PI / 2); r.cylinder(0.016, 0.36, 8, metal, dt); r.pop(); // mag tube
    r.push(); r.translate(0, -0.045, 0.26); r.box(0.052, 0.055, 0.17, wood, [0.75, 0.6, 0.42]); r.pop(); // pump grip
    r.push(); r.translate(0, -0.02, -0.24); r.rotateX(-0.1); r.box(0.055, 0.13, 0.24, wood, [0.72, 0.57, 0.4]); r.pop(); // wooden stock
    r.push(); r.translate(0, -0.1, -0.08); r.rotateX(0.3); r.box(0.045, 0.11, 0.06, grip); r.pop(); // grip
    r.push(); r.translate(0, 0.075, 0.5); r.box(0.012, 0.025, 0.012, { tile: T.brass }, [1.5, 1.3, 0.7]); r.pop(); // bead sight
    for (let i = 0; i < 4; i++) { // shell carrier with brass shells on the receiver side
      r.push(); r.translate(0.038, -0.01, -0.06 + i * 0.045); r.rotateZ(Math.PI / 2); r.cylinder(0.011, 0.05, 6, { tile: T.brass }, [1.2, 1.0, 0.5]); r.pop();
    }
    r.push(); r.translate(0, 0.03, -0.02); r.box(0.064, 0.02, 0.1, { tile: T.white }, [0.85, 0.8, 0.7]); r.pop(); // maker's plate
  } else if (kind === 'rifle') {
    r.push();
    r.box(0.055, 0.1, 0.4, metal); // receiver
    r.translate(0, 0.01, 0.3); r.box(0.048, 0.065, 0.2, grip); // handguard
    r.translate(0, 0.005, 0.16); r.rotateX(Math.PI / 2); r.cylinder(0.014, 0.12, 8, metal, dt); r.pop();
    r.push(); r.translate(0, 0.005, 0.56); r.box(0.045, 0.045, 0.05, metal, dt); r.pop(); // muzzle brake
    r.push(); r.translate(0, -0.14, 0.02); r.rotateX(-0.16); r.box(0.04, 0.19, 0.065, metal, [0.16, 0.16, 0.18]); r.pop(); // curved mag (tilted)
    r.push(); r.translate(0, -0.08, -0.13); r.rotateX(0.28); r.box(0.042, 0.11, 0.06, grip); r.pop(); // grip
    r.push(); r.translate(0, -0.01, -0.27); r.box(0.045, 0.075, 0.15, { tile: T.clothDark }, [0.3, 0.3, 0.32]); r.pop(); // stock
    r.push(); r.translate(0, 0.085, -0.02); r.box(0.016, 0.035, 0.2, metal, dt); r.translate(0, 0.012, -0.08); r.box(0.01, 0.02, 0.01, { tile: T.white }, [1.6, 1.6, 1.6]); r.pop(); // carry handle + dot
    r.push(); r.translate(0, 0.055, 0.28); r.box(0.012, 0.045, 0.012, metal, dt); r.pop(); // sight post
  }
}

// ---------------- vehicles (local frame: front toward +Z, ground at y=0) ----------------
export function drawVehicle(r, T, kind, o = {}) {
  const paint = { tile: T.white };
  const glass = { tile: T.carGlass };
  const spin = o.wheelSpin || 0;
  const wheel = (x, z, big) => {
    r.push(); r.translate(x, big ? 0.42 : 0.34, z); r.rotateY(0); r.rotateZ(Math.PI / 2); r.rotateY(spin);
    r.cylinder(big ? 0.42 : 0.34, 0.24, 12, { tile: T.tire }, [1, 1, 1], 0, T.hub);
    r.pop();
  };
  if (kind === 'bike') {
    r.push(); r.translate(0, 0.33, 0.85); r.rotateX(Math.PI / 2); r.cylinder(0.33, 0.09, 12, { tile: T.tire }, [1, 1, 1], 0, T.hub); r.pop();
    r.push(); r.translate(0, 0.31, -0.8); r.rotateX(Math.PI / 2); r.cylinder(0.31, 0.09, 12, { tile: T.tire }, [1, 1, 1], 0, T.hub); r.pop();
    r.push(); r.translate(0, 0.55, 0.1); r.rotateX(0.15); r.box(0.2, 0.16, 1.15, paint, o.tint || [0.55, 0.16, 0.14]); r.pop(); // frame/fairing
    r.push(); r.translate(0, 0.72, 0.62); r.rotateX(-0.5); r.wedge(0.34, 0.3, 0.4, paint, o.tint || [0.55, 0.16, 0.14]); r.pop(); // front fairing
    r.push(); r.translate(0, 0.78, -0.25); r.box(0.3, 0.09, 0.55, { tile: T.clothDark }, [0.15, 0.15, 0.16]); r.pop(); // seat
    r.push(); r.translate(0, 0.62, 0.55); r.box(0.36, 0.05, 0.06, { tile: T.gunMetal }); r.pop(); // bars
    r.push(); r.translate(0, 0.66, 0.88); r.box(0.17, 0.11, 0.04, { tile: T.white }, [1.5, 1.45, 1.2], 0.35); r.pop(); // headlight lens
    for (const sx of [-1, 1]) { r.push(); r.translate(sx * 0.25, 0.79, 0.5); r.box(0.1, 0.06, 0.03, { tile: T.gunMetal }, [0.6, 0.65, 0.7]); r.pop(); } // mirrors
    r.push(); r.translate(0.15, 0.3, -0.45); r.rotateX(Math.PI / 2); r.cylinder(0.048, 0.75, 7, { tile: T.gunMetal }, [0.72, 0.72, 0.75]); r.pop(); // exhaust
    r.push(); r.translate(0, 0.5, -0.95); r.box(0.2, 0.07, 0.03, { tile: T.white }, [1.1, 0.25, 0.2], 0.3); r.pop(); // tail light
    return;
  }
  if (kind === 'boat') {
    r.push(); r.translate(0, 0.25, 0); r.wedge(4.6, 0.8, 1.9, paint, o.tint || [0.8, 0.78, 0.74]); r.rotateY(Math.PI); r.pop();
    r.push(); r.translate(0, 0.55, -0.4); r.box(3.4, 0.5, 1.7, paint, o.tint || [0.8, 0.78, 0.74]); r.pop();
    r.push(); r.translate(0, 1.0, -0.7); r.box(1.7, 0.55, 1.2, glass); r.pop();
    r.push(); r.translate(0, 1.35, -0.7); r.box(2.0, 0.08, 1.4, paint, [0.4, 0.36, 0.32]); r.pop();
    r.push(); r.translate(0.8, 1.1, 0.6); r.box(0.08, 1.1, 0.08, { tile: T.gunMetal }); r.pop(); // mast
    r.push(); r.translate(0, 0.32, 0); r.box(4.66, 0.1, 1.96, paint, [0.62, 0.2, 0.16]); r.pop(); // hull stripe / rub rail
    for (const sz of [-1, 1]) { // deck rails on posts
      r.push(); r.translate(-0.3, 0.98, sz * 0.8); r.box(3.0, 0.045, 0.045, { tile: T.gunMetal }, [0.75, 0.76, 0.78]); r.pop();
      for (const px of [-1.7, -0.3, 1.1]) { r.push(); r.translate(px, 0.76, sz * 0.8); r.box(0.04, 0.44, 0.04, { tile: T.gunMetal }, [0.75, 0.76, 0.78]); r.pop(); }
    }
    r.push(); r.translate(-1.9, 0.85, 0); r.cylinder(0.16, 0.07, 10, { tile: T.white }, [0.9, 0.35, 0.2]); r.pop(); // life ring on the stern deck
    return;
  }
  const L = kind === 'truck' ? 6.4 : 4.5, Wd = kind === 'truck' ? 2.3 : 1.82;
  const tint = o.tint || [0.5, 0.52, 0.55];
  if (kind === 'truck') {
    const cabMat = { front: T.windshield, back: T.white, left: T.cabinSide, right: T.cabinSide, top: T.white, bottom: T.white };
    r.push(); r.translate(0, 0.85, 1.9); r.box(2.2, 1.5, 1.6, cabMat, tint); r.pop(); // cab with glass + interior
    r.push(); r.translate(0, 1.25, 2.68); r.box(1.9, 0.55, 0.14, glass); r.pop();
    r.push(); r.translate(0, 0.52, 2.72); r.plane(1.3, 0.34, T.grille); r.pop(); // grille
    r.push(); r.translate(0, 0.24, 2.78); r.box(2.24, 0.22, 0.18, { tile: T.white }, [0.16, 0.16, 0.18]); r.pop(); // bumper
    for (const sx of [-1, 1]) {
      r.push(); r.translate(sx * 0.72, 0.62, 2.72); r.box(0.4, 0.16, 0.03, { tile: T.white }, [1.5, 1.45, 1.2], 0.35); r.pop(); // headlights
      r.push(); r.translate(sx * 1.16, 1.3, 2.4); r.box(0.06, 0.16, 0.22, paint, tint); r.pop(); // mirrors
      r.push(); r.translate(sx * 0.5, 0.6, -3.06); r.box(0.42, 0.14, 0.03, { tile: T.white }, [1.1, 0.25, 0.2], 0.3); r.pop(); // tail lights
    }
    const cargoMat = { front: T.corrugated, back: T.corrugated, left: T.truckSide, right: T.truckSide, top: T.corrugated, bottom: T.corrugated };
    r.push(); r.translate(0, 1.45, -1.15); r.box(2.3, 2.3, 3.6, cargoMat, [0.98, 0.98, 0.98]); r.pop(); // cargo with flank art
    r.push(); r.translate(0, 0.32, 0); r.box(2.0, 0.3, 6.2, { tile: T.white }, [0.16, 0.16, 0.17]); r.pop();
    wheel(-1.05, 2.1, true); wheel(1.05, 2.1, true); wheel(-1.05, -1.9, true); wheel(1.05, -1.9, true);
  } else {
    const flank = kind === 'taxi' ? T.carFlankTaxi : kind === 'stock' ? T.carFlankStock : T.carFlank;
    const bodyMat = { front: T.white, back: T.white, left: flank, right: flank, top: T.white, bottom: T.white };
    r.push(); r.translate(0, 0.52, 0); r.box(Wd, 0.62, L, bodyMat, tint); r.pop(); // body: panelled flanks, door seams + handles
    r.push(); r.translate(0, 0.86, 0); r.box(Wd, 0.06, L * 0.96, paint, tint.map((v) => v * 1.06)); r.pop(); // shoulder line
    const cabinMat = { front: T.windshield, back: T.carGlass, left: T.cabinSide, right: T.cabinSide, top: T.carGlass, bottom: T.carGlass };
    if (kind === 'pickup') {
      r.push(); r.translate(0, 1.05, 0.95); r.box(Wd * 0.92, 0.55, 1.6, cabinMat, [1, 1, 1]); r.pop(); // cab with interior
      r.push(); r.translate(0, 1.32, 0.95); r.box(Wd * 0.96, 0.07, 1.7, paint, tint); r.pop();
      const bedTint = tint.map((v) => v * 0.92); // open bed: floor, walls, tailgate
      r.push(); r.translate(0, 0.8, -1.35); r.box(Wd * 0.94, 0.08, 1.9, { tile: T.white }, [0.2, 0.2, 0.22]); r.pop();
      for (const sx of [-1, 1]) { r.push(); r.translate(sx * (Wd * 0.47 - 0.045), 1.02, -1.35); r.box(0.09, 0.5, 1.9, paint, bedTint); r.pop(); }
      r.push(); r.translate(0, 1.02, -2.28); r.box(Wd * 0.94, 0.5, 0.09, paint, bedTint); r.pop();
    } else {
      r.push(); r.translate(0, 1.06, -0.15); r.box(Wd * 0.88, 0.52, L * 0.48, cabinMat, [1, 1, 1]); r.pop(); // cabin: windshield + interior glass
      r.push(); r.translate(0, 1.34, -0.15); r.box(Wd * 0.92, 0.06, L * 0.52, paint, tint); r.pop(); // roof
      for (const px of [-Wd * 0.4, Wd * 0.4]) { r.push(); r.translate(px, 1.06, 0.85); r.box(0.09, 0.5, 0.09, paint, tint); r.pop(); } // A pillars hint
      for (const px of [-Wd * 0.4, Wd * 0.4]) { r.push(); r.translate(px, 1.06, -1.12); r.box(0.09, 0.5, 0.09, paint, tint); r.pop(); } // C pillars hint
    }
    wheel(-Wd / 2, L / 2 - 0.75); wheel(Wd / 2, L / 2 - 0.75); wheel(-Wd / 2, -L / 2 + 0.75); wheel(Wd / 2, -L / 2 + 0.75);
    // lights + plates
    for (const sx of [-1, 1]) {
      r.push(); r.translate(sx * Wd * 0.32, 0.62, L / 2 + 0.012); r.box(0.34, 0.13, 0.02, { tile: T.white }, [1.5, 1.45, 1.2], 0.35); r.pop(); // headlight lens
      r.push(); r.translate(sx * Wd * 0.46, 0.62, L / 2 + 0.012); r.box(0.11, 0.1, 0.02, { tile: T.white }, [1.4, 0.9, 0.3], 0.3); r.pop(); // indicator
      r.push(); r.translate(sx * Wd * 0.32, 0.62, -L / 2 - 0.012); r.box(0.34, 0.12, 0.02, { tile: T.white }, [1.1, 0.25, 0.2], 0.3); r.pop(); // taillight lens
      r.push(); r.translate(sx * (Wd / 2 + 0.05), 0.95, 0.75); r.box(0.05, 0.1, 0.16, paint, tint); r.pop(); // mirrors
      r.push(); r.translate(sx * 0.14, 0.68, -L / 2 - 0.05); r.cylinder(0.035, 0.12, 6, { tile: T.gunMetal }); r.pop(); // exhaust
    }
    r.push(); r.translate(0, 0.42, L / 2 + 0.015); r.plane(0.52, 0.13, T.plate1); r.pop();
    r.push(); r.translate(0, 0.42, -L / 2 - 0.015); r.rotateY(Math.PI); r.plane(0.52, 0.13, T.plate2); r.pop();
    // bumpers, grille, side skirts, antenna
    r.push(); r.translate(0, 0.3, L / 2 + 0.07); r.box(Wd * 1.01, 0.2, 0.24, { tile: T.white }, [0.16, 0.16, 0.18]); r.pop(); // front bumper
    r.push(); r.translate(0, 0.3, -L / 2 - 0.07); r.box(Wd * 1.01, 0.2, 0.24, { tile: T.white }, [0.16, 0.16, 0.18]); r.pop(); // rear bumper
    r.push(); r.translate(0, 0.56, L / 2 + 0.015); r.plane(0.95, 0.2, T.grille); r.pop(); // grille
    for (const sx of [-1, 1]) { r.push(); r.translate(sx * (Wd / 2 + 0.012), 0.22, 0); r.box(0.05, 0.13, L * 0.5, { tile: T.white }, [0.14, 0.14, 0.16]); r.pop(); } // side skirts
    r.push(); r.translate(Wd * 0.3, 1.62, -L * 0.32); r.cylinder(0.011, 0.52, 5, { tile: T.gunMetal }, [0.4, 0.4, 0.42]); r.pop(); // antenna
    if (kind === 'taxi') {
      r.push(); r.translate(0, 1.48, -0.15); r.box(0.62, 0.16, 0.3, { front: T.taxiSign, back: T.taxiSign, left: T.taxiSign, right: T.taxiSign, top: T.white, bottom: T.white }); r.pop();
      r.push(); r.translate(0, 0.55, 0); r.box(Wd + 0.012, 0.16, L * 0.98, { tile: T.white }, [0.13, 0.13, 0.14]); r.pop(); // checker band base
    }
    if (kind === 'stock') {
      r.push(); r.translate(0, 1.02, -L / 2 + 0.28); r.box(1.5, 0.07, 0.34, { tile: T.clothDark }, [0.14, 0.14, 0.15]); r.pop(); // wing
      for (const sx of [-1, 1]) r.push(), r.translate(sx * 0.55, 0.82, -L / 2 + 0.28), r.box(0.07, 0.3, 0.07, { tile: T.gunMetal }), r.pop();
      for (const sx of [-1, 1]) { r.push(); r.translate(sx * (Wd / 2 + 0.008), 0.6, 0.2); r.rotateY(sx * Math.PI / 2); r.plane(0.78, 0.78, T.roundel); r.pop(); }
      for (const sx of [-1, 1]) { r.push(); r.translate(sx * (Wd / 2 + 0.008), 0.58, -1.15); r.rotateY(sx * Math.PI / 2); r.plane(1.9, 0.42, T.sponsor); r.pop(); } // sponsor flank graphics
      r.push(); r.translate(0, 0.3, L / 2 - 0.1); r.box(Wd * 1.02, 0.16, 0.3, { tile: T.clothDark }, [0.14, 0.14, 0.15]); r.pop(); // splitter
    }
    if (kind === 'cop') {
      for (const sx of [-1, 1]) { r.push(); r.translate(sx * (Wd / 2 + 0.008), 0.58, 0.1); r.rotateY(sx * Math.PI / 2); r.plane(1.7, 0.42, T.pbpdSide); r.pop(); }
      r.push(); r.translate(0, 1.44, -0.15); r.box(0.95, 0.11, 0.3, { tile: T.white }, [0.2, 0.2, 0.22]); r.pop(); // light bar base
      const ph = o.lightPhase || 0;
      r.push(); r.translate(-0.25, 1.46, -0.15); r.box(0.42, 0.09, 0.26, { tile: T.white }, [1.9, 0.3, 0.25], ph % 2 ? 0.9 : 0.05); r.pop();
      r.push(); r.translate(0.25, 1.46, -0.15); r.box(0.42, 0.09, 0.26, { tile: T.white }, [0.3, 0.45, 1.9], ph % 2 ? 0.05 : 0.9); r.pop();
      r.push(); r.translate(0, 0.45, L / 2 + 0.14); r.box(1.5, 0.34, 0.08, { tile: T.gunMetal }); r.pop(); // push bar
      for (const sx of [-1, 1]) r.push(), r.translate(sx * 0.6, 0.45, L / 2 + 0.08), r.box(0.07, 0.3, 0.2, { tile: T.gunMetal }), r.pop();
    }
  }
}

// ---------------- the make.fun ghost (3D, ~2.1 m tall) ----------------
export function drawGhost(r, T, t) {
  const white = { tile: T.white };
  const bob = Math.sin(t * 1.6) * 0.06;
  r.push(); r.translate(0, bob, 0);
  r.push(); r.translate(0, 1.02, 0); r.cylinder(0.52, 1.15, 14, white, [0.96, 0.97, 1.0], 0, T.white); r.pop(); // body
  r.push(); r.translate(0, 1.62, 0); r.scale(1, 0.82, 1); r.cylinder(0.52, 0.5, 14, white, [0.96, 0.97, 1.0], 0, T.white); r.pop(); // domed head
  for (let i = 0; i < 5; i++) { // wavy hem
    r.push(); r.translate(Math.sin(i / 4 * Math.PI * 2) * 0.4, 0.42, Math.cos(i / 4 * Math.PI * 2) * 0.4); r.box(0.2, 0.24, 0.2, white, [0.94, 0.95, 0.99]); r.pop();
  }
  for (const sx of [-1, 1]) { // eyes
    r.push(); r.translate(sx * 0.17, 1.66, 0.47); r.box(0.09, 0.15, 0.05, { tile: T.white }, [0.08, 0.08, 0.12]); r.pop();
  }
  r.push(); r.translate(0, 1.47, 0.5); r.box(0.1, 0.045, 0.04, { tile: T.white }, [0.15, 0.13, 0.16]); r.pop(); // small smile
  for (const sx of [-1, 1]) { // arms reaching forward, holding the coin
    r.push(); r.translate(sx * 0.52, 1.18, 0.18); r.rotateX(-0.9); r.box(0.15, 0.42, 0.15, white, [0.95, 0.96, 1.0]); r.pop();
  }
  r.push(); r.translate(0, 1.16, 0.52); r.rotateX(0.25); // the magenta star coin
  r.cylinder(0.3, 0.05, 24, { tile: T.white }, [0.9, 0.24, 0.55], 0.25, T.starCoin);
  r.pop();
  r.pop();
}

// ---------------- giant Tung Sahur (~7.5 m) ----------------
export function drawSahur(r, T, t) {
  const wood = { tile: T.wood };
  const sway = Math.sin(t * 0.9) * 0.02;
  r.push(); r.rotateZ(sway);
  for (const sx of [-1, 1]) { // stubby legs
    r.push(); r.translate(sx * 0.55, 0.55, 0); r.box(0.42, 1.1, 0.46, wood, [0.8, 0.68, 0.5]); r.pop();
    r.push(); r.translate(sx * 0.55, 0.06, 0.12); r.box(0.46, 0.12, 0.7, wood, [0.6, 0.48, 0.34]); r.pop(); // feet
  }
  r.push(); r.translate(0, 2.6, 0); r.cylinder(1.02, 2.9, 14, wood, [0.92, 0.78, 0.58], 0, T.wood); r.pop(); // torso drum
  for (const zz of [-1.2, 0, 1.2]) { // drum bands
    r.push(); r.translate(0, 2.6 + zz * 0.0, 0); r.translate(0, zz, 0); r.cylinder(1.06, 0.14, 14, { tile: T.bark }, [0.7, 0.55, 0.4]); r.pop();
  }
  // head
  r.push(); r.translate(0, 4.6, 0);
  r.box(1.05, 1.15, 1.0, wood, [0.95, 0.8, 0.6]);
  for (const sx of [-1, 1]) { // big round eyes
    r.push(); r.translate(sx * 0.26, 0.14, 0.51); r.box(0.2, 0.24, 0.04, { tile: T.white }, [1.3, 1.3, 1.28]); r.translate(0, 0, 0.025); r.box(0.09, 0.11, 0.02, { tile: T.white }, [0.08, 0.07, 0.06]); r.pop();
    r.push(); r.translate(sx * 0.26, 0.34, 0.51); r.box(0.26, 0.06, 0.04, { tile: T.bark }, [0.5, 0.38, 0.26]); r.pop(); // brows
  }
  r.push(); r.translate(0, -0.12, 0.51); r.box(0.13, 0.3, 0.05, wood, [0.85, 0.7, 0.5]); r.pop(); // nose
  r.push(); r.translate(0, -0.38, 0.51); r.box(0.44, 0.07, 0.04, { tile: T.white }, [0.3, 0.2, 0.12]); r.pop(); // mouth
  r.push(); r.translate(0, 0.66, 0); r.box(1.1, 0.16, 1.05, { tile: T.bark }, [0.72, 0.56, 0.4]); r.pop(); // cap rim
  r.pop();
  // left arm holds a kettle drum at its side; right arm raises the club
  r.push(); r.translate(-1.25, 3.3, 0); r.rotateZ(0.5); r.box(0.34, 1.7, 0.38, wood, [0.88, 0.74, 0.55]); r.pop();
  r.push(); r.translate(-1.75, 2.2, 0.3); r.rotateX(Math.PI / 2); r.cylinder(0.5, 0.5, 12, { tile: T.bark }, [0.75, 0.6, 0.44], 0, T.wood); r.pop(); // side drum
  const raise = Math.sin(t * 1.7) > 0 ? 0.25 : 0;
  r.push(); r.translate(1.3, 3.6, 0); r.rotateZ(-2.2 - raise); r.box(0.34, 1.8, 0.38, wood, [0.88, 0.74, 0.55]);
  r.translate(0, -1.6, 0); r.rotateZ(0.1); r.cylinder(0.17, 1.7, 9, wood, [0.8, 0.64, 0.46], 0, T.wood); r.pop(); // club
  r.pop();
}

export { matTranslate, matRotY };
