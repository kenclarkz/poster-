const SoundKit = (() => {
  'use strict';

  let ctx = null, master = null, musicBus = null, sfxBus = null;
  let playing = false, timer = null, nextBar = 0, barNum = 0;

  const TEMPO = 92;
  const BEAT = 60 / TEMPO;
  const BARLEN = BEAT * 4;
  const SWING = BEAT / 6;
  const LOOKAHEAD = 0.8;

  const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Smoky lounge loop: Dm9 -> G13 -> Cmaj9 -> A7b13
  const PROG = [
    { root: 38, kind: 'm7',   v: [62, 65, 72, 76] },
    { root: 43, kind: '7',    v: [59, 62, 65, 67] },
    { root: 36, kind: 'maj7', v: [64, 67, 71, 74] },
    { root: 45, kind: '7b13', v: [61, 64, 65, 67] },
  ];
  const THIRD = { m7: 3, '7': 4, maj7: 4, '7b13': 4 };
  const SEV = { m7: 10, '7': 10, maj7: 11, '7b13': 10 };

  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.8;
      sfxBus.connect(master);
      const resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };
      document.addEventListener('pointerdown', resume);
      document.addEventListener('keydown', resume);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function piano(t, notes, dur, vel) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    lp.Q.value = 0.7;
    const bus = ctx.createGain();
    bus.gain.value = vel;
    lp.connect(bus);
    bus.connect(musicBus);
    notes.forEach((n, i) => {
      const st = t + i * 0.012;
      [[1, 'triangle', 1], [2, 'sine', 0.35]].forEach(([mul, type, amp]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = mf(n) * mul;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(amp, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
        o.connect(g);
        g.connect(lp);
        o.start(st);
        o.stop(st + dur + 0.05);
      });
    });
  }

  function bass(t, midi, dur, vel) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    ['triangle', 'sine'].forEach((type) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = mf(midi);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
    lp.connect(g);
    g.connect(musicBus);
  }

  function tick(t, vel) {
    const s = ctx.createBufferSource();
    s.buffer = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 7000;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    s.connect(bp);
    bp.connect(g);
    g.connect(musicBus);
    s.start(t);
    s.stop(t + 0.08);
  }

  function scheduleBar(i, t) {
    const bar = PROG[i % PROG.length];
    const next = PROG[(i + 1) % PROG.length];

    // comping: pad on beat 1, swung stab on "2 &", stab on 4
    piano(t, bar.v, 2.4, 0.14);
    piano(t + 1.5 * BEAT + SWING, bar.v, 0.5, 0.11);
    piano(t + 3 * BEAT, bar.v, 0.9, 0.12);

    // walking bass: root, fifth, seventh, chromatic approach to next root
    const walk = [bar.root, bar.root + 7, bar.root + SEV[bar.kind]];
    let ap = next.root - 1;
    if (ap === walk[2]) ap = next.root + 1;
    walk.push(ap);
    walk.forEach((n, k) => bass(t + k * BEAT, n, BEAT * 0.95, 0.26));

    // brushed ticks on every beat plus swung offbeats
    for (let b = 0; b < 4; b++) {
      tick(t + b * BEAT, 0.05);
      tick(t + b * BEAT + 0.5 * BEAT + SWING, 0.03);
    }
  }

  function scheduler() {
    while (nextBar < ctx.currentTime + LOOKAHEAD) {
      scheduleBar(barNum, nextBar);
      nextBar += BARLEN;
      barNum++;
    }
  }

  function startMusic() {
    ensureCtx();
    nextBar = ctx.currentTime + 0.12;
    barNum = 0;
    timer = setInterval(scheduler, 240);
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.6);
    playing = true;
  }

  function stopMusic() {
    if (timer) { clearInterval(timer); timer = null; }
    if (ctx) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    playing = false;
  }

  function blip(midi, delay, dur, type, vel) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = mf(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const sfx = {
    card() {
      try { ensureCtx(); } catch { return; }
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      s.buffer = noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500;
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      s.connect(bp);
      bp.connect(g);
      g.connect(sfxBus);
      s.start(t);
      s.stop(t + 0.1);
    },
    chip() {
      try { ensureCtx(); } catch { return; }
      blip(91, 0, 0.05, 'square', 0.05);
      blip(96, 0.04, 0.06, 'square', 0.05);
    },
    win() {
      try { ensureCtx(); } catch { return; }
      [76, 79, 83, 88].forEach((n, i) => blip(n, i * 0.09, 0.35, 'triangle', 0.12));
    },
    lose() {
      try { ensureCtx(); } catch { return; }
      blip(64, 0, 0.25, 'sine', 0.1);
      blip(58, 0.18, 0.45, 'sine', 0.1);
    },
    push() {
      try { ensureCtx(); } catch { return; }
      blip(69, 0, 0.3, 'sine', 0.08);
    },
  };

  return {
    toggleMusic() {
      if (playing) stopMusic(); else startMusic();
      return playing;
    },
    sfx,
  };
})();
