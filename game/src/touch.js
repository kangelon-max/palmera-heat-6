// Touch controls for Palmera Heat IV — a DOM overlay that drives the exact
// same input state the keyboard/mouse use (the keys map, the mouse-look
// deltas and the two mouse buttons), so the simulation never knows the
// difference. Desktop is untouched: nothing here is created unless the
// device reports touch (or ?touch=1 is passed for testing).
//
// Layout: a floating joystick wherever the left thumb lands (left 45% of
// the screen, minimap zone excluded), look-drag anywhere else, and a
// Palmera-styled button cluster on the right. While driving, FIRE/AIM/DECOY
// hide, CAR becomes EXIT, JUMP becomes BRAKE and a RADIO button appears.
// Menus (title / pause / weapon wheel) are worked by plain taps, routed to
// the same click handlers the mouse uses.

const JOY_R = 56;          // joystick travel radius, CSS px
const JOY_DEAD = 0.28;     // dead zone as a fraction of JOY_R
const LOOK_SENS = 2.3;     // phone drags are short: amplify into mouse deltas
const TAP_MS = 350, TAP_PX = 12;

function keyTap(code) {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
}

export function initTouch(api) {
  const forced = new URLSearchParams(location.search).get('touch') === '1';
  const hasTouch = forced || 'ontouchstart' in window || navigator.maxTouchPoints > 0 ||
    (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  if (!hasTouch) return;
  window.__palmeraTouch = true;

  const hud = document.getElementById('hud');
  const root = document.createElement('div');
  root.id = 'tui';
  root.innerHTML =
    '<div id="tlook"></div>' +
    '<div id="tjoy"><div id="tknob"></div></div>' +
    '<div id="t-rotate">&#8635; Putar HP-mu — Palmera Heat IV paling enak dimainkan landscape.</div>' +
    '<button class="tbtn t-main" id="t-fire">FIRE</button>' +
    '<button class="tbtn" id="t-aim">AIM</button>' +
    '<button class="tbtn" id="t-e">E</button>' +
    '<button class="tbtn" id="t-f">CAR</button>' +
    '<button class="tbtn" id="t-g">DECOY</button>' +
    '<button class="tbtn" id="t-jump">JUMP</button>' +
    '<button class="tbtn t-toggle" id="t-run">RUN</button>' +
    '<button class="tbtn" id="t-radio">RADIO</button>' +
    '<button class="tbtn t-small" id="t-wheel">WHEEL</button>' +
    '<button class="tbtn t-small" id="t-pause">| |</button>';
  document.body.appendChild(root);
  const $ = (id) => root.querySelector(id);
  const look = $('#tlook'), joy = $('#tjoy'), knob = $('#tknob'), rotate = $('#t-rotate');
  const bFire = $('#t-fire'), bAim = $('#t-aim'), bE = $('#t-e'), bF = $('#t-f'), bG = $('#t-g'),
    bJump = $('#t-jump'), bRun = $('#t-run'), bRadio = $('#t-radio'), bWheel = $('#t-wheel'), bPause = $('#t-pause');
  const playBtns = [bFire, bAim, bE, bF, bG, bJump, bRun, bWheel, bPause];

  // ---------- button wiring ----------
  function hold(el, down, up) {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); api.startAudio(); down(); }, { passive: false });
    const end = (e) => { e.preventDefault(); up(); };
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
  }
  function tapKey(el, code) {
    el.addEventListener('touchstart', (e) => { e.preventDefault(); api.startAudio(); keyTap(code); }, { passive: false });
  }
  // FIRE aims while held: on a phone there is no second thumb for the mouse's
  // right button, so holding FIRE raises the gun (shoulder camera, hero faces
  // the camera) and shoots — exactly the desktop RMB+LMB combination.
  hold(bFire, () => { api.setAim(true); api.setFire(true); }, () => { api.setAim(false); api.setFire(false); });
  hold(bAim, () => api.setAim(true), () => api.setAim(false));
  hold(bJump, () => { api.keys.Space = true; }, () => { api.keys.Space = false; });
  tapKey(bE, 'KeyE');
  tapKey(bF, 'KeyF');
  tapKey(bG, 'KeyG');
  tapKey(bRadio, 'KeyR');
  tapKey(bWheel, 'Tab');
  tapKey(bPause, 'KeyM');
  let sprint = false;
  bRun.addEventListener('touchstart', (e) => {
    e.preventDefault(); api.startAudio();
    sprint = !sprint; api.keys.ShiftLeft = sprint;
    bRun.classList.toggle('on', sprint);
  }, { passive: false });

  // ---------- joystick + look layer ----------
  let joyId = null, joyX = 0, joyY = 0;       // joystick touch + origin
  let lookId = null, lookX = 0, lookY = 0;    // look touch + last position
  let tapT = 0, tapX = 0, tapY = 0, tapMoved = false;
  const joyKeys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false };
  function setJoyKeys(nx, ny) {
    const want = {
      KeyW: ny < -JOY_DEAD, KeyS: ny > JOY_DEAD,
      KeyA: nx < -JOY_DEAD, KeyD: nx > JOY_DEAD,
    };
    for (const k in want) if (want[k] !== joyKeys[k]) { joyKeys[k] = want[k]; api.keys[k] = want[k]; }
  }
  function clearJoy() {
    for (const k in joyKeys) if (joyKeys[k]) { joyKeys[k] = false; api.keys[k] = false; }
    joy.style.display = 'none';
  }
  function inMinimap(x, y) {
    // The radar owns the bottom-left: touches starting there are ignored so
    // the joystick never covers it. Canvas coords -> CSS px via the rect.
    const r = hud.getBoundingClientRect(), s = r.width / hud.width;
    return x < 200 * s && y > r.height - 232 * s;
  }
  look.addEventListener('touchstart', (e) => {
    e.preventDefault(); api.startAudio();
    const st = api.state();
    const controlsUp = (st.mode === 'play' || st.mode === 'shot') && !st.paused && !st.wheelOpen;
    for (const t of e.changedTouches) {
      if (controlsUp && joyId === null && t.clientX < innerWidth * 0.45 && !inMinimap(t.clientX, t.clientY)) {
        joyId = t.identifier; joyX = t.clientX; joyY = t.clientY;
        joy.style.display = 'block';
        joy.style.left = (joyX - 64) + 'px'; joy.style.top = (joyY - 64) + 'px';
        knob.style.transform = 'translate(0px,0px)';
      } else if (lookId === null) {
        lookId = t.identifier; lookX = tapX = t.clientX; lookY = tapY = t.clientY;
        tapT = performance.now(); tapMoved = false;
      }
    }
  }, { passive: false });
  look.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        let dx = t.clientX - joyX, dy = t.clientY - joyY;
        const d = Math.hypot(dx, dy);
        if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        setJoyKeys(dx / JOY_R, dy / JOY_R);
      } else if (t.identifier === lookId) {
        const dx = t.clientX - lookX, dy = t.clientY - lookY;
        lookX = t.clientX; lookY = t.clientY;
        if (Math.abs(t.clientX - tapX) + Math.abs(t.clientY - tapY) > TAP_PX) tapMoved = true;
        const st = api.state();
        if (st.mode === 'play' && !st.paused && !st.wheelOpen) api.look(dx * LOOK_SENS, dy * LOOK_SENS);
      }
    }
  }, { passive: false });
  function lookEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; clearJoy(); }
      else if (t.identifier === lookId) {
        lookId = null;
        if (!tapMoved && performance.now() - tapT < TAP_MS) api.tap(t.clientX, t.clientY);
      }
    }
  }
  look.addEventListener('touchend', lookEnd, { passive: false });
  look.addEventListener('touchcancel', lookEnd, { passive: false });

  // ---------- state-driven visibility (signature-checked, no churn) ----------
  let sig = -1;
  function poll() {
    requestAnimationFrame(poll);
    const st = api.state();
    const modeCode = st.mode === 'title' ? 0 : st.mode === 'shot' ? 2 : 1;
    const s = modeCode | (st.paused ? 4 : 0) | (st.wheelOpen ? 8 : 0) | (st.driving ? 16 : 0) |
      (innerWidth < innerHeight ? 32 : 0);
    if (s === sig) return;
    sig = s;
    const playing = modeCode !== 0 && !st.paused && !st.wheelOpen;
    for (const b of playBtns) b.style.display = playing ? 'block' : 'none';
    if (playing) {
      bRadio.style.display = st.driving ? 'block' : 'none';
      bFire.style.display = st.driving ? 'none' : 'block';
      bAim.style.display = st.driving ? 'none' : 'block';
      bG.style.display = st.driving ? 'none' : 'block';
      bF.textContent = st.driving ? 'EXIT' : 'CAR';
      bJump.textContent = st.driving ? 'BRAKE' : 'JUMP';
    }
    rotate.style.display = (modeCode !== 0 && innerWidth < innerHeight) ? 'block' : 'none';
    if (!playing && joyId !== null) { joyId = null; clearJoy(); }
  }
  requestAnimationFrame(poll);
}
