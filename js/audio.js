const AudioEngine = (() => {
  const MUSIC_LEVEL = 0.5;
  const TEMPO = 88;
  const SWING = 0.66;

  let ctx = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuf = null;
  let schedulerTimer = null;
  let nextBarTime = 0;
  let barCount = 0;

  let musicOn = readPref("bj_music", true);
  let sfxOn = readPref("bj_sfx", true);

  function readPref(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === "1";
    } catch {
      return fallback;
    }
  }

  function writePref(key, value) {
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {}
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 3;
      comp.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = musicOn ? MUSIC_LEVEL : 0;
      musicGain.connect(comp);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(comp);
      noiseBuf = makeNoise();
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function makeNoise() {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function midi(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function noiseSource() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  function playBass(t, note, dur, vel) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = midi(note);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp).connect(g).connect(musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function playKeys(t, notes, dur, vel) {
    notes.forEach((note, i) => {
      const start = t + i * 0.014;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = midi(note);
      osc.detune.value = (i % 2 === 0 ? -4 : 4);
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = midi(note);
      osc2.detune.value = 3;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1700;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(vel, start + 0.03);
      g.gain.exponentialRampToValueAtTime(vel * 0.45, start + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.5);
      osc.connect(lp);
      osc2.connect(lp);
      lp.connect(g).connect(musicGain);
      osc.start(start);
      osc2.start(start);
      osc.stop(start + dur + 0.6);
      osc2.stop(start + dur + 0.6);
    });
  }

  function playHat(t, vel, open) {
    const dur = open ? 0.16 : 0.05;
    const src = noiseSource();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp).connect(g).connect(musicGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function playRim(t, vel) {
    const src = noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1750;
    bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(bp).connect(g).connect(musicGain);
    src.start(t);
    src.stop(t + 0.08);
  }

  function playKick(t, vel) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    osc.connect(g).connect(musicGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  function playPluck(t, note, dur, vel) {
    [0, 3].forEach((det) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = midi(note);
      osc.detune.value = det === 0 ? -3 : 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.7);
      osc.connect(g).connect(musicGain);
      osc.start(t);
      osc.stop(t + dur + 0.8);
    });
  }

  const PROG = [
    { root: 36, chord: [64, 67, 71, 74] },
    { root: 45, chord: [60, 64, 67, 71] },
    { root: 38, chord: [65, 69, 72, 76] },
    { root: 43, chord: [59, 62, 65, 69] }
  ];

  const BASS_PATTERNS = [
    [0, 7, 5],
    [0, 7, 9],
    [0, 5, 7],
    [0, 10, 5]
  ];

  const PENTA = [72, 74, 76, 79, 81, 84];

  function scheduleBar(t0) {
    const beat = 60 / TEMPO;
    const barLen = beat * 4;
    const ch = PROG[barCount % PROG.length];
    const nextCh = PROG[(barCount + 1) % PROG.length];
    const pat = BASS_PATTERNS[barCount % BASS_PATTERNS.length];
    const approach = nextCh.root >= ch.root ? nextCh.root - 1 : nextCh.root + 1;
    const bassNotes = [
      ch.root,
      ch.root + pat[1],
      ch.root + pat[2],
      approach
    ];
    bassNotes.forEach((n, i) => {
      playBass(t0 + i * beat, n, beat * 0.92, i === 0 ? 0.5 : 0.38);
    });

    playKeys(t0, ch.chord, beat * 1.6, 0.11);
    if (Math.random() < 0.62) {
      playKeys(t0 + beat + beat * SWING, ch.chord.slice(1), beat * 0.8, 0.07);
    }

    for (let i = 0; i < 4; i++) {
      const ti = t0 + i * beat;
      playHat(ti, i % 2 === 1 ? 0.05 : 0.032, false);
      if (Math.random() < 0.72) playHat(ti + beat * SWING, 0.02, false);
      if ((i === 1 || i === 3) && Math.random() < 0.85) playRim(ti, 0.075);
      if (i === 0 && Math.random() < 0.75) playKick(ti, 0.12);
    }

    if (barCount % 2 === 1 && Math.random() < 0.42) {
      let idx = 1 + Math.floor(Math.random() * (PENTA.length - 2));
      let t = t0 + beat * (1 + SWING);
      const steps = [0, 1, -1, 2];
      steps.forEach((step, k) => {
        idx = Math.min(PENTA.length - 1, Math.max(0, idx + step));
        const dur = beat * (Math.random() < 0.4 ? 0.95 : 0.48);
        playPluck(t, PENTA[idx], dur, 0.075);
        t += beat * (k === 1 || k === 2 ? 0.66 : 1);
      });
    }

    barCount++;
  }

  function schedulerTick() {
    const beat = 60 / TEMPO;
    while (nextBarTime < ctx.currentTime + 0.35) {
      scheduleBar(nextBarTime);
      nextBarTime += beat * 4;
    }
  }

  function startMusic() {
    if (!ensure()) return;
    musicOn = true;
    writePref("bj_music", true);
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(MUSIC_LEVEL, ctx.currentTime, 0.25);
    if (!schedulerTimer) {
      nextBarTime = ctx.currentTime + 0.1;
      barCount = 0;
      schedulerTimer = setInterval(schedulerTick, 40);
    }
  }

  function stopMusic(persist = true) {
    if (persist) {
      musicOn = false;
      writePref("bj_music", false);
    }
    if (ctx && musicGain) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    }
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  }

  function toggleMusic() {
    if (musicOn) stopMusic();
    else startMusic();
    return musicOn;
  }

  function toggleSfx() {
    sfxOn = !sfxOn;
    writePref("bj_sfx", sfxOn);
    return sfxOn;
  }

  function blip(freq, tOffset, dur, vel, type = "sine") {
    if (!ensure()) return;
    const t = ctx.currentTime + tOffset;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function swish(dur = 0.09, freq = 2400, vel = 0.22) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(freq, t);
    bp.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(sfxGain);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  const sfx = {
    card() {
      if (musicOnGuard()) return;
      swish(0.08, 2600, 0.18);
    },
    flip() {
      if (musicOnGuard()) return;
      swish(0.13, 1800, 0.24);
    },
    chip() {
      if (musicOnGuard()) return;
      blip(1900, 0, 0.04, 0.12, "square");
      blip(2300, 0.045, 0.05, 0.1, "square");
    },
    shuffle() {
      if (musicOnGuard()) return;
      swish(0.5, 1400, 0.2);
    },
    win() {
      if (musicOnGuard()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        blip(f, i * 0.09, 0.34, 0.16, "triangle")
      );
    },
    blackjack() {
      if (musicOnGuard()) return;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        blip(f, i * 0.085, 0.42, 0.17, "triangle")
      );
    },
    lose() {
      if (musicOnGuard()) return;
      blip(233.08, 0, 0.28, 0.14, "triangle");
      blip(174.61, 0.16, 0.4, 0.14, "triangle");
    },
    push() {
      if (musicOnGuard()) return;
      blip(440, 0, 0.18, 0.1, "sine");
      blip(440, 0.14, 0.18, 0.08, "sine");
    }
  };

  function musicOnGuard() {
    return !sfxOn || !ensure();
  }

  document.addEventListener(
    "pointerdown",
    () => {
      if (ensure() && musicOn) startMusic();
    },
    { once: true }
  );

  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  return {
    ensure,
    startMusic,
    stopMusic,
    toggleMusic,
    toggleSfx,
    musicEnabled: () => musicOn,
    sfxEnabled: () => sfxOn,
    sfx
  };
})();
