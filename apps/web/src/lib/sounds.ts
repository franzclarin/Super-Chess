// All sounds synthesized via Web Audio API — no audio files needed.
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

export function playMeow(): void {
  const c = getCtx(), now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  lfo.frequency.value = 5; lfoG.gain.value = 30;
  lfo.connect(lfoG); lfoG.connect(osc.frequency);
  osc.connect(g); g.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(550, now);
  osc.frequency.linearRampToValueAtTime(920, now + 0.1);
  osc.frequency.linearRampToValueAtTime(680, now + 0.25);
  osc.frequency.linearRampToValueAtTime(440, now + 0.42);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.22, now + 0.06);
  g.gain.linearRampToValueAtTime(0.18, now + 0.25);
  g.gain.linearRampToValueAtTime(0, now + 0.48);
  lfo.start(now); lfo.stop(now + 0.5);
  osc.start(now); osc.stop(now + 0.5);
}

export function playBark(): void {
  const c = getCtx(), now = c.currentTime;
  const len = Math.floor(c.sampleRate * 0.12);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const n = c.createBufferSource(); n.buffer = buf;
  const filt = c.createBiquadFilter(); filt.type = 'bandpass';
  filt.frequency.value = 700; filt.Q.value = 1.5;
  const gN = c.createGain();
  gN.gain.setValueAtTime(0.5, now); gN.gain.linearRampToValueAtTime(0, now + 0.12);
  n.connect(filt); filt.connect(gN); gN.connect(c.destination);
  const osc = c.createOscillator(); osc.type = 'sine';
  const gO = c.createGain();
  osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(55, now + 0.18);
  gO.gain.setValueAtTime(0.55, now); gO.gain.linearRampToValueAtTime(0, now + 0.22);
  osc.connect(gO); gO.connect(c.destination);
  n.start(now); n.stop(now + 0.14);
  osc.start(now); osc.stop(now + 0.25);
}

export function playChirp(): void {
  const c = getCtx(), now = c.currentTime;
  for (let i = 0; i < 2; i++) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = 'triangle';
    const t = now + i * 0.1;
    osc.frequency.setValueAtTime(1800 + i * 400, t);
    osc.frequency.linearRampToValueAtTime(3200 + i * 300, t + 0.05);
    osc.frequency.linearRampToValueAtTime(2000, t + 0.09);
    g.gain.setValueAtTime(0.28, t);
    g.gain.linearRampToValueAtTime(0, t + 0.1);
    osc.start(t); osc.stop(t + 0.12);
  }
}

export function playExplosion(): void {
  const c = getCtx(), now = c.currentTime;
  const dur = 0.9;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
  }
  const noise = c.createBufferSource(); noise.buffer = buf;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2000, now); lp.frequency.linearRampToValueAtTime(120, now + 0.5);
  const gN = c.createGain();
  gN.gain.setValueAtTime(0.85, now); gN.gain.linearRampToValueAtTime(0, now + dur);
  noise.connect(lp); lp.connect(gN); gN.connect(c.destination);
  const sub = c.createOscillator(); sub.type = 'sine';
  sub.frequency.setValueAtTime(90, now); sub.frequency.linearRampToValueAtTime(28, now + 0.45);
  const gS = c.createGain();
  gS.gain.setValueAtTime(0.6, now); gS.gain.linearRampToValueAtTime(0, now + 0.55);
  sub.connect(gS); gS.connect(c.destination);
  const click = c.createOscillator(); click.type = 'square'; click.frequency.value = 60;
  const gC = c.createGain();
  gC.gain.setValueAtTime(0.7, now); gC.gain.linearRampToValueAtTime(0, now + 0.04);
  click.connect(gC); gC.connect(c.destination);
  noise.start(now); noise.stop(now + dur);
  sub.start(now); sub.stop(now + 0.6);
  click.start(now); click.stop(now + 0.05);
}

const ANIMAL_SOUNDS = [playMeow, playBark, playChirp];
export function playAnimal(): void {
  ANIMAL_SOUNDS[Math.floor(Math.random() * ANIMAL_SOUNDS.length)]();
}
