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
    limb(r, 0.48, 0.155, 0.17, pantsM, o.pantsTint);
    r.translate(0, -0.48, 0);
    if (pose.sit) r.rotateX(1.5);
    else if (!pose.swim) r.rotateX(Math.max(0, -Math.sin(walk + (side > 0 ? 0 : Math.PI))) * 0.5);
    if (o.shorts) limb(r, 0.44, 0.11, 0.12, { tile: skin }, SKIN_TINTS[o.skin]);
    else limb(r, 0.44, 0.12, 0.13, pantsM, o.pantsTint);
    r.translate(0, -0.44, 0.02);
    r.box(0.11, 0.07, 0.24, { tile: T.white }, o.shoeTint || [0.2, 0.19, 0.2]); // shoe
    r.pop();
  }

  // ---- torso: stacked masses so the silhouette tapers (hips -> narrow
  // waist -> chest -> shoulders) instead of reading as one crate ----
  r.push();
  r.translate(0, 0.98, 0);
  if (pose.lean) r.rotateX(pose.lean);
  r.push(); r.translate(0, 0.05, 0); r.box(0.4, 0.17, 0.23, pantsM, o.pantsTint); r.pop(); // hips
  r.push(); r.translate(0, 0.22, 0); r.box(0.385, 0.2, 0.215, shirtM, o.shirtTint); r.pop(); // waist
  r.push(); r.translate(0, 0.42, 0); r.box(0.46, 0.26, 0.25, shirtM, o.shirtTint); r.pop(); // chest
  r.push(); r.translate(0, 0.585, 0); r.box(0.5, 0.09, 0.26, shirtM, o.shirtTint); r.pop(); // shoulders
  r.push(); r.translate(0, -0.03, 0); r.box(0.4, 0.06, 0.22, { tile: T.white }, [0.16, 0.13, 0.1]); r.pop(); // belt

  // ---- arms + weapon ----
  const aim = pose.aim, carry = pose.carry && pose.weapon && !pose.swim; // a swimmer's arms crawl-stroke; the weapon stays holstered
  for (const side of [-1, 1]) {
    r.push();
    r.translate(side * 0.28, 0.52, 0);
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
  r.translate(0, 0.58, 0);
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
    hScale: R.range(0.94, 1.06),
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
    const glassM = { tile: T.carGlass };
    const darkM = { tile: T.white };
    const dark = [0.13, 0.13, 0.15];
    const W = 1.88; // the whole fleet wears a sports-coupe shell now: low, wide, planted
    // ---- hull: low main body, hood wedging down to a sharp nose ----
    r.push(); r.translate(0, 0.46, -0.42); r.box(W, 0.56, L - 0.85, bodyMat, tint); r.pop(); // main hull, panelled flanks
    r.push(); r.translate(0, 0.44, L / 2 - 0.44); r.wedge(W * 0.97, 0.33, 0.92, paint, tint); r.pop(); // sloped hood
    r.push(); r.translate(0, 0.3, L / 2 + 0.03); r.box(W * 0.96, 0.3, 0.16, darkM, dark); r.pop(); // front intake
    r.push(); r.translate(0, 0.1, L / 2 + 0.08); r.box(W * 1.0, 0.07, 0.42, darkM, dark); r.pop(); // splitter
    for (const sx of [-1, 1]) {
      r.push(); r.translate(sx * W * 0.28, 0.56, L / 2 + 0.1); r.box(0.54, 0.07, 0.05, { tile: T.white }, [1.6, 1.55, 1.35], 0.55); r.pop(); // slim LED headlights
      for (const wz of [L / 2 - 0.85, -L / 2 + 0.85]) { r.push(); r.translate(sx * (W / 2 + 0.02), 0.52, wz); r.box(0.09, 0.36, 1.06, paint, tint.map((v) => v * 0.92)); r.pop(); } // fender flares
      r.push(); r.translate(sx * (W / 2 + 0.01), 0.19, -0.2); r.box(0.05, 0.15, 2.1, darkM, dark); r.pop(); // side skirt
      r.push(); r.translate(sx * (W / 2 + 0.005), 0.52, -1.18); r.box(0.04, 0.2, 0.52, darkM, dark); r.pop(); // rear intake scoop
      r.push(); r.translate(sx * (W / 2 + 0.07), 1.02, 0.28); r.box(0.05, 0.09, 0.2, paint, tint); r.pop(); // mirror
    }
    // low-profile sports wheels on spoked hubs
    const wheelS = (x, z) => { r.push(); r.translate(x, 0.37, z); r.rotateZ(Math.PI / 2); r.rotateY(spin); r.cylinder(0.37, 0.27, 14, { tile: T.tire }, [1, 1, 1], 0, T.hub); r.pop(); };
    wheelS(-W / 2 - 0.01, L / 2 - 0.85); wheelS(W / 2 + 0.01, L / 2 - 0.85); wheelS(-W / 2 - 0.01, -L / 2 + 0.85); wheelS(W / 2 + 0.01, -L / 2 + 0.85);
    if (kind === 'pickup') {
      // sporty pickup: same low nose, cab raked forward, open bed behind
      r.push(); r.translate(0, 0.68, 0.62); r.wedge(W * 0.82, 0.5, 0.8, { tile: T.windshield }, [1, 1, 1]); r.pop(); // raked windshield
      const cabinMatP = { front: T.carGlass, back: T.carGlass, left: T.cabinSide, right: T.cabinSide, top: T.carGlass, bottom: T.carGlass };
      r.push(); r.translate(0, 0.94, -0.05); r.box(W * 0.84, 0.44, 1.05, cabinMatP, [1, 1, 1]); r.pop(); // cab glasshouse
      r.push(); r.translate(0, 1.19, -0.05); r.box(W * 0.88, 0.06, 1.15, paint, tint); r.pop(); // roof
      const bedTint = tint.map((v) => v * 0.92); // open bed: floor, walls, tailgate
      r.push(); r.translate(0, 0.62, -1.5); r.box(W * 0.94, 0.08, 1.75, darkM, [0.2, 0.2, 0.22]); r.pop();
      for (const sx of [-1, 1]) { r.push(); r.translate(sx * (W * 0.47 - 0.045), 0.82, -1.5); r.box(0.09, 0.44, 1.75, paint, bedTint); r.pop(); }
      r.push(); r.translate(0, 0.82, -2.35); r.box(W * 0.94, 0.44, 0.09, paint, bedTint); r.pop();
    } else {
      // teardrop glasshouse set well back, mid-engine coupe style
      r.push(); r.translate(0, 0.7, 0.6); r.wedge(W * 0.8, 0.52, 0.85, { tile: T.windshield }, [1, 1, 1]); r.pop(); // windshield rake
      const cabinMat = { front: T.carGlass, back: T.carGlass, left: T.cabinSide, right: T.cabinSide, top: T.carGlass, bottom: T.carGlass };
      r.push(); r.translate(0, 0.96, -0.5); r.box(W * 0.82, 0.44, 1.65, cabinMat, [1, 1, 1]); r.pop(); // cabin glass with interior
      r.push(); r.translate(0, 1.21, -0.55); r.box(W * 0.86, 0.06, 1.5, paint, kind === 'cop' ? [0.16, 0.16, 0.18] : tint); r.pop(); // roof (black on the interceptor)
      r.push(); r.translate(0, 0.72, -1.62); r.rotateY(Math.PI); r.wedge(W * 0.8, 0.48, 0.72, glassM, [1, 1, 1]); r.pop(); // rear glass slope
      r.push(); r.translate(0, 0.66, -1.95); r.box(W * 0.94, 0.16, 0.75, paint, tint); r.pop(); // decklid
    }
    // rear: full-width light bar (flares under braking), diffuser, quad exhausts, plates
    r.push(); r.translate(0, 0.6, -L / 2 - 0.06); r.box(W * 0.82, 0.08, 0.05, { tile: T.white }, [1.5, 0.3, 0.24], o.brake ? 0.95 : 0.35); r.pop();
    r.push(); r.translate(0, 0.24, -L / 2 - 0.05); r.box(W * 0.9, 0.24, 0.1, darkM, dark); r.pop(); // diffuser
    for (const fx of [-0.3, 0, 0.3]) { r.push(); r.translate(fx * W * 0.5, 0.2, -L / 2 - 0.1); r.box(0.05, 0.18, 0.05, darkM, [0.2, 0.2, 0.22]); r.pop(); } // diffuser fins
    for (const sx of [-1, 1]) for (const ex of [0.48, 0.66]) { r.push(); r.translate(sx * ex, 0.3, -L / 2 - 0.08); r.rotateX(Math.PI / 2); r.cylinder(0.045, 0.14, 7, { tile: T.gunMetal }, [0.7, 0.7, 0.73]); r.pop(); } // quad exhausts
    r.push(); r.translate(0, 0.42, L / 2 + 0.13); r.plane(0.52, 0.13, T.plate1); r.pop();
    r.push(); r.translate(0, 0.44, -L / 2 - 0.115); r.rotateY(Math.PI); r.plane(0.52, 0.13, T.plate2); r.pop();
    r.push(); r.translate(0, 1.28, -1.2); r.box(0.05, 0.09, 0.24, darkM, dark); r.pop(); // shark-fin antenna
    if (kind === 'taxi') {
      r.push(); r.translate(0, 1.33, -0.55); r.box(0.55, 0.14, 0.26, { front: T.taxiSign, back: T.taxiSign, left: T.taxiSign, right: T.taxiSign, top: T.white, bottom: T.white }); r.pop(); // sleek roof sign
      r.push(); r.translate(0, 0.48, -0.2); r.box(W + 0.012, 0.14, L * 0.88, { tile: T.white }, [0.13, 0.13, 0.14]); r.pop(); // checker band base
    }
    if (kind === 'stock') {
      r.push(); r.translate(0, 1.04, -L / 2 + 0.28); r.box(1.6, 0.07, 0.36, { tile: T.clothDark }, [0.14, 0.14, 0.15]); r.pop(); // bigger wing
      for (const sx of [-1, 1]) r.push(), r.translate(sx * 0.58, 0.84, -L / 2 + 0.28), r.box(0.07, 0.32, 0.07, { tile: T.gunMetal }), r.pop();
      for (const sx of [-1, 1]) { r.push(); r.translate(sx * (W / 2 + 0.008), 0.55, 0.2); r.rotateY(sx * Math.PI / 2); r.plane(0.78, 0.78, T.roundel); r.pop(); }
      for (const sx of [-1, 1]) { r.push(); r.translate(sx * (W / 2 + 0.008), 0.53, -1.15); r.rotateY(sx * Math.PI / 2); r.plane(1.9, 0.42, T.sponsor); r.pop(); } // sponsor flank graphics
    }
    if (kind === 'cop') {
      // supercar interceptor: PBPD livery on the coupe shell, light bar
      // integrated flush into the black roof — no push bar, no sedan bulk
      for (const sx of [-1, 1]) { r.push(); r.translate(sx * (W / 2 + 0.008), 0.52, -0.2); r.rotateY(sx * Math.PI / 2); r.plane(1.9, 0.46, T.pbpdSide); r.pop(); }
      r.push(); r.translate(0, 1.26, -0.55); r.box(0.98, 0.05, 0.26, { tile: T.white }, [0.16, 0.16, 0.18]); r.pop(); // integrated light bar base
      const ph = o.lightPhase || 0;
      r.push(); r.translate(-0.25, 1.28, -0.55); r.box(0.44, 0.06, 0.22, { tile: T.white }, [1.9, 0.3, 0.25], ph % 2 ? 0.95 : 0.05); r.pop();
      r.push(); r.translate(0.25, 1.28, -0.55); r.box(0.44, 0.06, 0.22, { tile: T.white }, [0.3, 0.45, 1.9], ph % 2 ? 0.05 : 0.95); r.pop();
      r.push(); r.translate(0, 0.52, -L / 2 - 0.1); r.rotateY(Math.PI); r.plane(1.1, 0.24, T.pbpdSide); r.pop(); // rear PBPD lettering
      r.push(); r.translate(0, 0.8, -L / 2 + 0.06); r.box(W * 0.72, 0.05, 0.24, darkM, dark); r.pop(); // lip spoiler
    }
    if (kind === 'sedan' || kind === 'taxi') {
      r.push(); r.translate(0, 0.8, -L / 2 + 0.06); r.box(W * 0.72, 0.05, 0.24, paint, tint); r.pop(); // lip spoiler
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

// ---------------- giant Tung Sahur (~19 m) ----------------
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x * x;
/** Attack arm angle (rotateX at the shoulder): carry -> overhead windup ->
 *  vertical smash -> recover, driven by attackT in 0..1. In this renderer a
 *  hanging limb swings FORWARD (+Z) at negative rotateX, so the smash lands
 *  at -0.35 (down-forward) after the -2.95 overhead windup. */
function smashCurve(a) {
  if (a < 0.35) return -0.55 + (-2.95 + 0.55) * easeOut(a / 0.35);
  if (a < 0.55) return -2.95 + (-0.35 + 2.95) * easeIn((a - 0.35) / 0.2);
  return -0.35 + (-0.55 + 0.35) * easeOut((a - 0.55) / 0.45);
}
/** Kicking-leg hip angle over the same windup/strike/recover beats. */
function kickCurve(a) {
  if (a < 0.3) return 0.25 * easeOut(a / 0.3);
  if (a < 0.5) return 0.25 + (-1.6 - 0.25) * easeIn((a - 0.3) / 0.2);
  return -1.6 + 1.6 * easeOut((a - 0.5) / 0.5);
}
/**
 * The Sahur at true giant scale — about 19 m of carved wood. pose:
 * {phase (run cycle), run 0..1 (0 idle, ~0.45 walk, 1 full run),
 *  attack: null | 'punch' | 'kick', attackT 0..1}. The punch is an overhead
 * club smash; the kick swings the right leg through the target.
 */
export function drawSahur(r, T, t, pose = {}) {
  const wood = { tile: T.wood };
  const bark = { tile: T.bark };
  const phase = pose.phase || 0;
  const run = pose.run || 0;
  const amp = 0.3 + 0.7 * run; // stride amplitude grows with speed
  const bob = Math.abs(Math.sin(phase)) * 0.42 * run + Math.sin(t * 1.1) * 0.05;
  let bodyPitch = 0.13 * run; // forward lean at speed
  if (pose.attack === 'punch') bodyPitch += pose.attackT > 0.3 && pose.attackT < 0.6 ? 0.16 : 0.03;
  if (pose.attack === 'kick') bodyPitch -= pose.attackT > 0.25 && pose.attackT < 0.55 ? 0.1 : 0;

  r.push();
  r.scale(1.16, 1.16, 1.16); // drawn ~16.7 m, stands ~19.4 m in the world
  r.translate(0, bob, 0);
  r.rotateZ(Math.sin(phase) * 0.03 * run + Math.sin(t * 0.9) * 0.012);
  r.rotateX(bodyPitch);

  // ---- legs: long strides, thigh + shin + foot, knees that bend ----
  for (const sx of [-1, 1]) {
    const ph = phase + (sx > 0 ? Math.PI : 0);
    let thigh = Math.sin(ph) * 0.78 * amp;
    let knee = Math.max(0, -Math.cos(ph)) * 1.05 * amp + 0.04;
    if (pose.attack === 'kick' && sx > 0) { thigh = kickCurve(pose.attackT); knee = pose.attackT < 0.3 ? 0.55 : 0.05; }
    if (pose.attack === 'punch' && sx > 0) { thigh = 0.3; knee = 0.35; } // planted brace leg
    r.push();
    r.translate(sx * 1.15, 5.45, 0);
    r.rotateX(thigh);
    r.push(); r.translate(0, -1.35, 0); r.box(0.95, 2.7, 1.05, wood, [0.8, 0.68, 0.5]); r.pop(); // thigh
    r.translate(0, -2.7, 0);
    r.rotateX(knee);
    r.push(); r.translate(0, -1.25, 0); r.box(0.8, 2.5, 0.88, wood, [0.84, 0.71, 0.53]); r.pop(); // shin
    r.translate(0, -2.5, 0.35);
    r.box(1.0, 0.5, 1.95, wood, [0.62, 0.49, 0.35]); // foot
    r.pop();
  }

  // ---- pelvis + the great drum torso ----
  r.push(); r.translate(0, 5.95, 0); r.box(2.7, 1.25, 1.8, bark, [0.66, 0.52, 0.38]); r.pop();
  r.push(); r.translate(0, 9.15, 0); r.cylinder(2.78, 5.7, 16, wood, [0.92, 0.78, 0.58], 0, T.wood); r.pop(); // torso drum
  for (const by of [6.7, 9.15, 11.6]) {
    r.push(); r.translate(0, by, 0); r.cylinder(2.86, 0.42, 16, bark, [0.7, 0.55, 0.4]); r.pop(); // drum bands
  }
  r.push(); r.translate(0, 12.15, 0); r.box(4.6, 0.8, 2.2, wood, [0.88, 0.74, 0.55]); r.pop(); // shoulder beam

  // ---- head (centre ~14.6 m up, ~16.9 m before the root scale) ----
  r.push(); r.translate(0, 14.55, 0);
  r.box(2.7, 3.1, 2.55, wood, [0.95, 0.8, 0.6]);
  for (const sx of [-1, 1]) { // big round eyes
    r.push(); r.translate(sx * 0.66, 0.35, 1.29); r.box(0.5, 0.6, 0.08, { tile: T.white }, [1.3, 1.3, 1.28]); r.translate(0, 0, 0.05); r.box(0.22, 0.28, 0.04, { tile: T.white }, [0.08, 0.07, 0.06]); r.pop();
    r.push(); r.translate(sx * 0.66, 0.85, 1.29); r.box(0.66, 0.15, 0.08, bark, [0.5, 0.38, 0.26]); r.pop(); // brows
  }
  r.push(); r.translate(0, -0.3, 1.3); r.box(0.34, 0.75, 0.1, wood, [0.85, 0.7, 0.5]); r.pop(); // nose
  r.push(); r.translate(0, -0.95, 1.3); r.box(1.1, 0.17, 0.08, { tile: T.white }, [0.3, 0.2, 0.12]); r.pop(); // mouth
  r.push(); r.translate(0, 1.68, 0); r.box(2.85, 0.4, 2.7, bark, [0.72, 0.56, 0.4]); r.pop(); // cap rim
  r.push(); r.translate(0, 1.95, -0.2); r.cylinder(0.5, 0.5, 10, wood, [0.9, 0.76, 0.56]); r.pop(); // top knot
  r.pop();

  // ---- left arm: swings against the stride, kettle drum slung at the hip ----
  r.push();
  r.translate(-3.05, 11.75, 0);
  r.rotateX(Math.sin(phase) * 0.55 * amp + 0.08);
  r.push(); r.translate(0, -1.35, 0); r.box(0.85, 2.7, 0.92, wood, [0.88, 0.74, 0.55]); r.pop(); // upper arm
  r.translate(0, -2.7, 0);
  r.rotateX(-0.3);
  r.push(); r.translate(0, -1.2, 0); r.box(0.74, 2.4, 0.8, wood, [0.86, 0.72, 0.54]); r.pop(); // forearm
  r.translate(0, -2.45, 0);
  r.box(1.05, 0.95, 1.05, wood, [0.82, 0.68, 0.5]); // fist
  r.pop();
  r.push(); r.translate(-2.9, 6.8, 0.6); r.rotateX(Math.PI / 2); r.rotateZ(0.15); r.cylinder(1.15, 1.1, 14, bark, [0.75, 0.6, 0.44], 0, T.wood); r.pop(); // side drum

  // ---- right arm: carries the club, smashes with it ----
  const clubArm = pose.attack === 'punch' ? smashCurve(pose.attackT) : -0.55 + Math.sin(phase + Math.PI) * 0.35 * amp;
  r.push();
  r.translate(3.05, 11.75, 0);
  r.rotateX(clubArm);
  r.push(); r.translate(0, -1.35, 0); r.box(0.85, 2.7, 0.92, wood, [0.88, 0.74, 0.55]); r.pop(); // upper arm
  r.translate(0, -2.7, 0);
  r.rotateX(pose.attack === 'punch' ? -0.15 : -0.35);
  r.push(); r.translate(0, -1.2, 0); r.box(0.74, 2.4, 0.8, wood, [0.86, 0.72, 0.54]); r.pop(); // forearm
  r.translate(0, -2.45, 0);
  r.box(1.05, 0.95, 1.05, wood, [0.82, 0.68, 0.5]); // fist gripping the club
  r.push(); r.translate(0, -0.3, 0.3); r.rotateX(-0.5); // the kentongan club, business end down-forward
  r.cylinder(0.34, 4.6, 10, wood, [0.8, 0.64, 0.46], 0, T.wood);
  r.translate(0, -2.6, 0); r.cylinder(0.52, 1.3, 10, wood, [0.76, 0.6, 0.42], 0, T.wood); // club head
  r.pop();
  r.pop();
  r.pop();
}

export { matTranslate, matRotY };
