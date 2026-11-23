// Procedural WebAudio: two synth radio stations with named tracks, plus game SFX.
// Nothing is loaded; every sound is synthesized. Audio starts on the first user
// gesture and stays silent in screenshot mode.
export const STATIONS = [
  {
    name: 'COCO FM 101.1', mood: 'sun',
    tracks: ['Marla V — Rent Money', 'The Breakers — Pier Pressure', 'DJ Coco — Golden Hour', 'Los Faros — Lighthouse Eyes', 'Voss & Dre — Night Deposit'],
  },
  {
    name: 'PALMERA NIGHTS 88.4', mood: 'night',
    tracks: ['Ana Sirena — Low Tide', 'The Observatories — Crater Moon', 'Palm Ghost — Static Bloom', 'R. Calloway — Blue Lights', 'Sirena — Swim Out'],
  },
];

export class AudioEngine {
  constructor() { this.ctx = null; this.started = false; }
  start() {
    if (this.started) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(ctx.destination);
      this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.16; this.musicGain.connect(this.master);
      this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.master);
      this.started = true;
      this.station = 0; this.trackIdx = 0; this.nextNote = 0; this.step = 0;
      this.engineOsc = null;
    } catch { /* no audio: the game stays silent */ }
  }
  trackName() { const s = STATIONS[this.station]; return `${s.name} · ${s.tracks[this.trackIdx % s.tracks.length]}`; }
  nextStation() { this.station = (this.station + 1) % STATIONS.length; this.trackIdx = 0; this.step = 0; return this.trackName(); }
  /** Called every frame while driving: keeps a small step-sequenced loop alive. */
  updateMusic(dt, active) {
    if (!this.started) return;
    const ctx = this.ctx;
    if (!active) return;
    if (ctx.currentTime < this.nextNote) return;
    this.nextNote = ctx.currentTime + 0.235;
    const sun = STATIONS[this.station].mood === 'sun';
    const scale = sun ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10];
    const root = sun ? 220 : 174.6;
    const step = this.step++;
    if (step % 64 === 0 && step > 0) this.trackIdx++;
    const note = scale[Math.abs((step * 7 + (step >> 3) * 3) % scale.length)];
    const f = root * Math.pow(2, note / 12);
    this.tone(f, 0.22, sun ? 'triangle' : 'sine', this.musicGain, 0.5);
    if (step % 2 === 0) this.tone(root / 2, 0.3, 'sine', this.musicGain, 0.7); // bass
    if (step % 8 === 4) this.tone(f * 2, 0.4, 'sine', this.musicGain, 0.18); // sparkle
    if (step % 4 === 2) this.noise(0.05, 9000, this.musicGain, 0.12); // hat
  }
  tone(freq, dur, type, dest, vol = 0.5) {
    if (!this.started) return;
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(dest); o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }
  noise(dur, freq, dest, vol = 0.4) {
    if (!this.started) return;
    const ctx = this.ctx, len = Math.max(1, (dur * ctx.sampleRate) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(dest); src.start();
  }
  shot(kind) {
    if (!this.started) return;
    if (kind === 'shotgun') { this.noise(0.28, 900, this.sfxGain, 0.9); this.tone(70, 0.2, 'square', this.sfxGain, 0.4); }
    else if (kind === 'rifle') { this.noise(0.12, 2400, this.sfxGain, 0.6); this.tone(140, 0.08, 'square', this.sfxGain, 0.3); }
    else { this.noise(0.09, 3200, this.sfxGain, 0.5); this.tone(180, 0.06, 'square', this.sfxGain, 0.25); }
  }
  splash() { this.noise(0.35, 700, this.sfxGain, 0.35); }
  cash() { if (!this.started) return; this.tone(1320, 0.09, 'square', this.sfxGain, 0.16); setTimeout(() => this.tone(1760, 0.14, 'square', this.sfxGain, 0.16), 55); }
  click() { this.tone(660, 0.05, 'square', this.sfxGain, 0.2); }
  ding() { this.tone(880, 0.18, 'sine', this.sfxGain, 0.3); this.tone(1174, 0.3, 'sine', this.sfxGain, 0.22); }
  siren(on) {
    if (!this.started) return;
    if (on && !this.sirenOsc) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 720; g.gain.value = 0.035;
      lfo.frequency.value = 0.7; lg.gain.value = 160; lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master); o.start(); lfo.start();
      this.sirenOsc = { o, lfo, g };
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.o.stop(); this.sirenOsc.lfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
    }
  }
  engine(on, speedFrac) {
    if (!this.started) return;
    if (on && !this.engineOsc) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 55; g.gain.value = 0.05;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      o.connect(f); f.connect(g); g.connect(this.master); o.start();
      this.engineOsc = { o, g };
    }
    if (this.engineOsc) {
      this.engineOsc.o.frequency.value = 50 + speedFrac * 130;
      if (!on) { try { this.engineOsc.o.stop(); } catch { /* noop */ } this.engineOsc = null; }
    }
  }
}
