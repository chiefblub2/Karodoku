// Haptics and (optional) sound effects, both honouring the user's settings.

let hapticsOn = true;
let soundOn = false;
let ctx: AudioContext | null = null;

export function configureFeedback(opts: { haptics: boolean; sound: boolean }): void {
  hapticsOn = opts.haptics;
  soundOn = opts.sound;
}

export function vibrate(pattern: number | number[]): void {
  if (!hapticsOn || !('vibrate' in navigator)) return;
  try { navigator.vibrate(pattern); } catch { /* not allowed */ }
}

function audio(): AudioContext | null {
  if (!soundOn) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** Short filtered-noise burst; the building block for the wooden sounds. */
function burst(a: AudioContext, opts: { freq: number; q: number; dur: number; gain: number; delay?: number }): void {
  const t = a.currentTime + (opts.delay ?? 0);
  const len = Math.ceil(a.sampleRate * opts.dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = opts.freq;
  f.Q.value = opts.q;
  const g = a.createGain();
  g.gain.value = opts.gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export type Sound = 'clack' | 'lift' | 'mark' | 'error' | 'stamp' | 'tick';

export function play(sound: Sound): void {
  const a = audio();
  if (!a) return;
  switch (sound) {
    case 'clack':
      burst(a, { freq: 1900, q: 6, dur: 0.05, gain: 0.9 });
      burst(a, { freq: 900, q: 4, dur: 0.07, gain: 0.5, delay: 0.012 });
      break;
    case 'lift': burst(a, { freq: 2600, q: 8, dur: 0.03, gain: 0.35 }); break;
    case 'mark': burst(a, { freq: 4200, q: 1.5, dur: 0.06, gain: 0.25 }); break;
    case 'tick': burst(a, { freq: 3000, q: 10, dur: 0.02, gain: 0.25 }); break;
    case 'error':
      burst(a, { freq: 300, q: 3, dur: 0.12, gain: 0.6 });
      burst(a, { freq: 260, q: 3, dur: 0.12, gain: 0.5, delay: 0.1 });
      break;
    case 'stamp':
      burst(a, { freq: 160, q: 1.2, dur: 0.25, gain: 1.4 });
      burst(a, { freq: 1200, q: 2, dur: 0.06, gain: 0.5 });
      break;
  }
}
