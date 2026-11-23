// A compact hand-rolled WebGL renderer: one texture atlas, one lit shader with fog,
// immediate-mode geometry (boxes, wedges, cylinders, quads, billboards) pushed into
// either a static buffer (the city) or a per-frame buffer (everything that moves).
// Faces are shaded by a directional sun + hemisphere ambient, so volumes read as
// real 3D under a moving sky. No library, no network: everything is generated here.

// ---------- matrix helpers (column-major, WebGL convention) ----------
export function matIdentity() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
export function matMultiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
export function matPerspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = 2 * far * near / (near - far);
  return o;
}
export function matLookAt(eye, at, up) {
  const z = norm3([eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]]);
  const x = norm3(cross3(up, z)); const y = cross3(z, x);
  const o = matIdentity();
  o[0] = x[0]; o[4] = x[1]; o[8] = x[2];
  o[1] = y[0]; o[5] = y[1]; o[9] = y[2];
  o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
  o[12] = -dot3(x, eye); o[13] = -dot3(y, eye); o[14] = -dot3(z, eye);
  return o;
}
export function matTranslate(x, y, z) { const o = matIdentity(); o[12] = x; o[13] = y; o[14] = z; return o; }
export function matScale(x, y, z) { const o = matIdentity(); o[0] = x; o[5] = y; o[10] = z; return o; }
export function matRotX(a) { const c = Math.cos(a), s = Math.sin(a), o = matIdentity(); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; }
export function matRotY(a) { const c = Math.cos(a), s = Math.sin(a), o = matIdentity(); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; }
export function matRotZ(a) { const c = Math.cos(a), s = Math.sin(a), o = matIdentity(); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; }
export function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export function transformPoint(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}
function transformNormal(m, n) {
  const [x, y, z] = n;
  return norm3([
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ]);
}

// ---------- texture atlas ----------
const ATLAS_SIZE = 2048;
export class Atlas {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_SIZE; this.canvas.height = ATLAS_SIZE;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
    this.shelfY = 0; this.shelfX = 0; this.shelfH = 0;
    this.tiles = new Map();
  }
  /** Reserve a tile and paint it with painter(ctx, w, h). Returns the tile record. */
  tile(name, w, h, painter) {
    if (this.tiles.has(name)) return this.tiles.get(name);
    if (this.shelfX + w > ATLAS_SIZE) { this.shelfX = 0; this.shelfY += this.shelfH; this.shelfH = 0; }
    if (this.shelfY + h > ATLAS_SIZE) throw new Error('atlas full at ' + name);
    const x = this.shelfX, y = this.shelfY;
    this.shelfX += w; this.shelfH = Math.max(this.shelfH, h);
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    painter(ctx, w, h);
    ctx.restore();
    // UV convention: texImage2D uploads the canvas with v=0 at its TOP row
    // (UNPACK_FLIP_Y_WEBGL is false), so a tile at canvas y..y+h maps to
    // v = y/S .. (y+h)/S — v0 is the tile's BOTTOM edge (canvas y+h).
    const rec = { u0: x / ATLAS_SIZE, v0: (y + h) / ATLAS_SIZE, u1: (x + w) / ATLAS_SIZE, v1: y / ATLAS_SIZE, w, h };
    this.tiles.set(name, rec);
    return rec;
  }
  get(name) { return this.tiles.get(name); }
}

// ---------- renderer ----------
const VS = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUv; attribute vec4 aCol;
uniform mat4 uProj, uView;
varying vec3 vNorm; varying vec2 vUv; varying vec4 vCol; varying float vDist;
void main() {
  vec4 wp = vec4(aPos, 1.0);
  vec4 vp = uView * wp;
  vNorm = aNorm; vUv = aUv; vCol = aCol; vDist = -vp.z;
  gl_Position = uProj * vp;
}`;
const FS = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uSunDir, uSunCol, uAmbSky, uAmbGnd, uFogCol;
uniform float uFogNear, uFogFar;
varying vec3 vNorm; varying vec2 vUv; varying vec4 vCol; varying float vDist;
void main() {
  vec4 texel = texture2D(uTex, vUv);
  if (texel.a < 0.45) discard;
  vec3 tex = texel.rgb;
  vec3 n = normalize(vNorm);
  float dl = max(dot(n, uSunDir), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  vec3 lit = tex * vCol.rgb * (uAmbGnd + (uAmbSky - uAmbGnd) * hemi + uSunCol * dl);
  lit += tex * vCol.a;
  float f = smoothstep(uFogNear, uFogFar, vDist);
  gl_FragColor = vec4(mix(lit, uFogCol, f), 1.0);
}`;
const VS_SPRITE = `
attribute vec3 aPos; attribute vec2 aUv; attribute vec4 aCol;
uniform mat4 uProj, uView;
varying vec2 vUv; varying vec4 vCol; varying float vDist;
void main() {
  vec4 vp = uView * vec4(aPos, 1.0);
  vUv = aUv; vCol = aCol; vDist = -vp.z;
  gl_Position = uProj * vp;
}`;
const FS_SPRITE = `
precision mediump float;
uniform sampler2D uTex;
uniform vec3 uFogCol; uniform float uFogNear, uFogFar;
varying vec2 vUv; varying vec4 vCol; varying float vDist;
void main() {
  vec4 t = texture2D(uTex, vUv);
  float f = smoothstep(uFogNear, uFogFar, vDist);
  gl_FragColor = vec4(mix(t.rgb * vCol.rgb, uFogCol, f), t.a * vCol.a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

const FLOATS = 12; // pos3 norm3 uv2 col4
export class Sink {
  constructor(gl, dynamic) {
    this.gl = gl;
    this.data = [];
    this.buffer = gl.createBuffer();
    this.dynamic = dynamic;
  }
  push(px, py, pz, nx, ny, nz, u, v, r, g, b, e) {
    this.data.push(px, py, pz, nx, ny, nz, u, v, r, g, b, e);
  }
  quad(corners, normal, tile, tint, emissive, uvFlip) {
    // corners: 4 points [x,y,z] in CCW order seen from the normal side
    const [r, g, b] = tint;
    const us = [tile.u0, tile.u1, tile.u1, tile.u0];
    const vs = uvFlip ? [tile.v1, tile.v1, tile.v0, tile.v0] : [tile.v0, tile.v0, tile.v1, tile.v1];
    const idx = corners.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3]; // cylinder caps emit triangles
    for (const i of idx) {
      const p = corners[i];
      this.push(p[0], p[1], p[2], normal[0], normal[1], normal[2], us[i], vs[i], r, g, b, emissive);
    }
  }
  upload() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.data), this.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    this.count = this.data.length / FLOATS;
  }
  clear() { this.data.length = 0; }
}

export class Renderer {
  constructor(canvas, atlas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl; this.canvas = canvas; this.atlas = atlas;
    this.prog = program(gl, VS, FS);
    this.progSprite = program(gl, VS_SPRITE, FS_SPRITE);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    // Anisotropic filtering: roads, sand and the pier deck are mostly seen at
    // grazing angles, where plain mipmaps smear them into streaks. Take the
    // best level the hardware offers (capped at 8) while the atlas is bound.
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) {
      const maxAniso = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
      gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, maxAniso));
    }
    this.staticSink = new Sink(gl, false);
    this.frameSink = new Sink(gl, true);
    this.spriteSink = new Sink(gl, true);
    this.stack = [matIdentity()];
    this.view = matIdentity(); this.proj = matIdentity();
    this.sunDir = [0, 1, 0]; this.sunCol = [1, 1, 1];
    this.ambSky = [0.5, 0.5, 0.5]; this.ambGnd = [0.25, 0.25, 0.25];
    this.fogCol = [0.8, 0.8, 0.8]; this.fogNear = 120; this.fogFar = 420;
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  }
  // ----- transform stack -----
  push() { this.stack.push(this.stack[this.stack.length - 1]); }
  pop() { this.stack.pop(); }
  mul(m) { const t = this.stack; t[t.length - 1] = matMultiply(t[t.length - 1], m); }
  translate(x, y, z) { this.mul(matTranslate(x, y, z)); }
  rotateX(a) { this.mul(matRotX(a)); }
  rotateY(a) { this.mul(matRotY(a)); }
  rotateZ(a) { this.mul(matRotZ(a)); }
  scale(x, y, z) { this.mul(matScale(x, y, z)); }
  top() { return this.stack[this.stack.length - 1]; }

  /** Set the sink that geometry pushes go to: 'static', 'frame' or 'sprite'. */
  use(kind) { this.sink = kind === 'static' ? this.staticSink : kind === 'sprite' ? this.spriteSink : this.frameSink; }

  _emit(local, normal, tile, tint, emissive) {
    const m = this.top();
    const pts = local.map((p) => transformPoint(m, p));
    const n = transformNormal(m, normal);
    // callers pass either a tile record or a material object ({tile} / {all})
    const tl = tile && typeof tile.u0 === 'number' ? tile : (tile && (tile.tile || tile.all)) || tile;
    this.sink.quad(pts, n, tl, tint, emissive, false);
  }
  /** Axis box centred at origin with size (w,h,d); mat: {tile} or {top,side,bottom} tiles or {color}. */
  box(w, h, d, mat, tint = [1, 1, 1], emissive = 0) {
    const x = w / 2, y = h / 2, z = d / 2;
    const isTile = mat && typeof mat.u0 === 'number';
    const T = (key) => isTile ? mat : (mat[key] || mat.tile || mat.all);
    const faces = [
      { n: [0, 0, 1], c: [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], t: T('front') },
      { n: [0, 0, -1], c: [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]], t: T('back') },
      { n: [1, 0, 0], c: [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]], t: T('right') },
      { n: [-1, 0, 0], c: [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]], t: T('left') },
      { n: [0, 1, 0], c: [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]], t: T('top') },
      { n: [0, -1, 0], c: [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]], t: T('bottom') },
    ];
    for (const f of faces) this._emit(f.c, f.n, f.t, tint, emissive);
  }
  /** Flat quad on the ground plane (XZ), size w×d, centred at origin, facing up.
   *  Corner order matches the box top face (CCW seen from above): starting at
   *  +Z and running +X first. The old order (-Z first) wound the triangles
   *  clockwise from above, so back-face culling removed every ground quad —
   *  roads, sand, the city slab and the sea never rasterized at all. */
  groundQuad(w, d, tile, tint = [1, 1, 1], emissive = 0) {
    const x = w / 2, z = d / 2;
    this._emit([[-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z]], [0, 1, 0], tile, tint, emissive);
  }
  /** Vertical quad of size w×h in the XY plane, centred at origin, facing +Z. */
  plane(w, h, tile, tint = [1, 1, 1], emissive = 0) {
    const x = w / 2, y = h / 2;
    this._emit([[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]], [0, 0, 1], tile, tint, emissive);
  }
  /** Right-triangle wedge: base w×d, height h, slope rising toward -Z. */
  wedge(w, h, d, tile, tint = [1, 1, 1], emissive = 0) {
    const x = w / 2, z = d / 2;
    const A = [-x, 0, z], B = [x, 0, z], C = [x, 0, -z], D = [-x, 0, -z], E = [-x, h, -z], F = [x, h, -z];
    const slope = norm3([0, d, h]);
    this._emit([A, B, F, E], slope, tile, tint, emissive);            // slope
    this._emit([D, C, B, A], [0, -1, 0], tile, tint, emissive);      // bottom (rarely seen)
    this._emit([C, F, E, D], [0, 0, -1], tile, tint, emissive);      // back
    this._emit([B, C, F, F], [1, 0, 0], tile, tint, emissive);       // right triangle
    this._emit([D, A, E, E], [-1, 0, 0], tile, tint, emissive);      // left triangle
  }
  /** Cylinder around Y axis, radius r, height h, centred at origin.
   *  bothSides also emits the inward faces (for sky domes seen from inside). */
  cylinder(r, h, seg, tile, tint = [1, 1, 1], emissive = 0, capTile = null, bothSides = false) {
    const y = h / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [Math.cos(a0) * r, -y, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, -y, Math.sin(a1) * r];
      const p2 = [Math.cos(a1) * r, y, Math.sin(a1) * r], p3 = [Math.cos(a0) * r, y, Math.sin(a0) * r];
      const n = norm3([Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
      this._emit([p0, p1, p2, p3], n, tile, tint, emissive);
      if (bothSides) this._emit([p1, p0, p3, p2], [-n[0], 0, -n[2]], tile, tint, emissive);
    }
    if (capTile) {
      const top = [], bot = [];
      for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; top.push([Math.cos(a) * r, y, Math.sin(a) * r]); bot.push([Math.cos(a) * r, -y, Math.sin(a) * r]); }
      for (let i = 1; i < seg - 1; i++) {
        this._emit([[0, y, 0], top[i], top[i + 1]], [0, 1, 0], capTile, tint, emissive);
        this._emit([[0, -y, 0], bot[i + 1], bot[i]], [0, -1, 0], capTile, tint, emissive);
      }
    }
  }
  /** Camera-facing glow billboard (sprite sink), size s, centred at origin of current transform. */
  billboard(s, tile, tint, alpha) {
    const m = this.top();
    const c = transformPoint(m, [0, 0, 0]);
    const right = norm3([this.view[0], this.view[4], this.view[8]]);
    const up = norm3([this.view[1], this.view[5], this.view[9]]);
    const h = s / 2;
    const corner = (sx, sy) => [
      c[0] + (right[0] * sx + up[0] * sy) * h,
      c[1] + (right[1] * sx + up[1] * sy) * h,
      c[2] + (right[2] * sx + up[2] * sy) * h,
    ];
    const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    const prev = this.sink; this.sink = this.spriteSink;
    this.sink.quad(pts, [0, 0, 1], tile, [tint[0], tint[1], tint[2]], alpha, false);
    this.sink = prev;
  }
  /** Soft round shadow blob lying on the ground at the current transform origin. */
  blobShadow(rx, rz, strength) {
    const m = this.top();
    const c = transformPoint(m, [0, 0, 0]);
    const pts = [
      [c[0] - rx, c[1], c[2] - rz], [c[0] + rx, c[1], c[2] - rz],
      [c[0] + rx, c[1], c[2] + rz], [c[0] - rx, c[1], c[2] + rz],
    ];
    const prev = this.sink; this.sink = this.spriteSink;
    this.sink.quad(pts, [0, 1, 0], this.atlas.get('shadow'), [0, 0, 0], strength, false);
    this.sink = prev;
  }

  beginFrame(view, proj) {
    this.view = view; this.proj = proj;
    this.frameSink.clear(); this.spriteSink.clear();
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(this.fogCol[0], this.fogCol[1], this.fogCol[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
  _bindAttribs(prog) {
    const gl = this.gl;
    const stride = FLOATS * 4;
    const loc = (n) => gl.getAttribLocation(prog, n);
    const setup = (name, size, off) => { const l = loc(name); if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride, off * 4); } };
    setup('aPos', 3, 0); setup('aNorm', 3, 3); setup('aUv', 2, 6); setup('aCol', 4, 8);
  }
  _drawSink(prog, sink) {
    const gl = this.gl;
    if (!sink.count) return;
    gl.useProgram(prog);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uProj'), false, this.proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uView'), false, this.view);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uSunDir'), this.sunDir);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uSunCol'), this.sunCol);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uAmbSky'), this.ambSky);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uAmbGnd'), this.ambGnd);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uFogCol'), this.fogCol);
    gl.uniform1f(gl.getUniformLocation(prog, 'uFogNear'), this.fogNear);
    gl.uniform1f(gl.getUniformLocation(prog, 'uFogFar'), this.fogFar);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, sink.buffer);
    this._bindAttribs(prog);
    gl.drawArrays(gl.TRIANGLES, 0, sink.count);
  }
  finishFrame() {
    this.frameSink.upload(); this.spriteSink.upload();
    const gl = this.gl;
    gl.disable(gl.BLEND);
    this._drawSink(this.prog, this.staticSink);
    this._drawSink(this.prog, this.frameSink);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    this._drawSink(this.progSprite, this.spriteSink);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  uploadStatic() { this.staticSink.upload(); }
}
