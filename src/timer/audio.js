/* ============================================================
   Ambience (Web Audio, synthesized)
============================================================ */
let AC = null, audioTimers = [];

function noiseBuffer(ctx){
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++){           // brown-ish noise
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

export function startAudio(scene){
  stopAudio();
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e){ return; }
  const master = AC.createGain();
  master.gain.value = 0.14;
  master.connect(AC.destination);

  const noiseSrc = () => {
    const src = AC.createBufferSource();
    src.buffer = noiseBuffer(AC); src.loop = true;
    return src;
  };
  const lfoTo = (param, freq, depth) => {
    const lfo = AC.createOscillator(), g = AC.createGain();
    lfo.frequency.value = freq; g.gain.value = depth;
    lfo.connect(g); g.connect(param); lfo.start();
  };

  if (scene === 'jungle'){
    const n = noiseSrc(), lp = AC.createBiquadFilter(), g = AC.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 240; g.gain.value = 0.5;
    n.connect(lp); lp.connect(g); g.connect(master); n.start();
    const chirp = () => {
      if (!AC) return;
      const t0 = AC.currentTime;
      for (let i = 0; i < 3; i++){
        const o = AC.createOscillator(), og = AC.createGain();
        o.type = 'sine';
        o.frequency.value = 4100 + Math.random() * 600;
        og.gain.setValueAtTime(0, t0 + i * 0.09);
        og.gain.linearRampToValueAtTime(0.05, t0 + i * 0.09 + 0.01);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.07);
        o.connect(og); og.connect(master);
        o.start(t0 + i * 0.09); o.stop(t0 + i * 0.09 + 0.1);
      }
    };
    audioTimers.push(setInterval(() => { if (Math.random() < 0.75) chirp(); }, 1100));
  }
  else if (scene === 'space'){
    const g = AC.createGain(); g.gain.value = 0.32;
    [[55, .3], [55.4, .3], [110.3, .12], [164.8, .05]].forEach(([f, v]) => {
      const o = AC.createOscillator(), og = AC.createGain();
      o.type = 'sine'; o.frequency.value = f; og.gain.value = v;
      o.connect(og); og.connect(g); o.start();
    });
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    g.connect(lp); lp.connect(master);
    lfoTo(g.gain, 0.05, 0.1);
  }
  else if (scene === 'blackhole'){
    const o = AC.createOscillator(), og = AC.createGain();
    o.type = 'sine'; o.frequency.value = 38; og.gain.value = 0.45;
    o.connect(og); og.connect(master); o.start();
    const n = noiseSrc(), lp = AC.createBiquadFilter(), ng = AC.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 95; ng.gain.value = 0.4;
    n.connect(lp); lp.connect(ng); ng.connect(master); n.start();
    lfoTo(og.gain, 0.03, 0.15);
  }
  else if (scene === 'ocean'){
    const n = noiseSrc(), lp = AC.createBiquadFilter(), g = AC.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 460; g.gain.value = 0.42;
    n.connect(lp); lp.connect(g); g.connect(master); n.start();
    lfoTo(lp.frequency, 0.07, 190);
    lfoTo(g.gain, 0.05, 0.16);
  }
}

export function stopAudio(){
  audioTimers.forEach(clearInterval);
  audioTimers = [];
  if (AC){ try { AC.close(); } catch(e){} AC = null; }
}

export function chime(){
  try {
    const ctx = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime;
    [660, 990].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.12);
      g.gain.linearRampToValueAtTime(0.18, t0 + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 1.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0 + i * 0.12); o.stop(t0 + i * 0.12 + 1.4);
    });
    if (!AC) setTimeout(() => ctx.close(), 2200);
  } catch(e){}
}
