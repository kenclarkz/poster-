(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    spin: $('spin'),
    music: $('music-toggle'),
    canvas: $('wheel'),
  };

  const { fmt, loadBankroll, save, sleep, rand, MIN_CHIP, DEFAULT_BANKROLL } = Arcade;

  const SLICES = [
    { m: 1, c: '#39d0ff' }, { m: 2, c: '#ffe14d' }, { m: 1, c: '#39ff88' },
    { m: 10, c: '#ff2ec4' }, { m: 1, c: '#39d0ff' }, { m: 5, c: '#ff7b00' },
    { m: 2, c: '#ffe14d' }, { m: 1, c: '#39ff88' }, { m: 20, c: '#ff3b5c' },
    { m: 1, c: '#39d0ff' }, { m: 2, c: '#ffe14d' }, { m: 1, c: '#39ff88' },
  ];
  const STEP = (Math.PI * 2) / SLICES.length;

  const CV = els.canvas;
  const ctx = CV.getContext('2d');
  const W = CV.width;
  const H = CV.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  CV.width = W * dpr;
  CV.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const CX = W / 2;
  const R = W / 2 - 26;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let rot = rand() * Math.PI * 2;
  let spinning = false;
  let lastWin = null;
  let pointerLock = { x: CX, y: 12, angle: -Math.PI / 2 };

  function renderStats() {
    els.bankroll.textContent = fmt(bankroll);
    els.bet.textContent = fmt(bet);
  }

  function setMsg(text, cls = '') {
    els.message.textContent = text;
    els.message.className = 'message' + (cls ? ' ' + cls : '');
  }

  function setBet(v) {
    bet = Math.max(5, Math.min(v, bankroll));
    renderStats();
  }

  function weight() {
    // weighted toward 1x and 2x
    const r = Math.random();
    if (r < 0.5) return 1;
    if (r < 0.82) return 2;
    if (r < 0.9) return 5;
    if (r < 0.97) return 10;
    return 20;
  }

  function pointerAngle() {
    return pointerLock.angle;
  }

  function drawWheel() {
    ctx.clearRect(0, 0, W, H);

    // neon glow ring
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(39,208,255,0.18)';
    ctx.shadowColor = '#39d0ff';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(CX, CX, R + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // slices
    for (let i = 0; i < SLICES.length; i++) {
      const a0 = rot + i * STEP - Math.PI / 2;
      const a1 = a0 + STEP;
      ctx.beginPath();
      ctx.moveTo(CX, CX);
      ctx.arc(CX, CX, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = SLICES[i].c;
      ctx.shadowColor = SLICES[i].c;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.save();
      ctx.translate(CX, CX);
      ctx.rotate(a0 + STEP / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.font = '800 30px Inter, sans-serif';
      ctx.fillText(SLICES[i].m + '\u00D7', R * 0.68, 11);
      ctx.restore();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#120c1e';
    for (let i = 0; i < SLICES.length; i++) {
      const a = rot + i * STEP - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(CX, CX);
      ctx.lineTo(CX + R * Math.cos(a), CX + R * Math.sin(a));
      ctx.stroke();
    }

    // hub
    const hubGrad = ctx.createRadialGradient(CX, CX, 5, CX, CX, R * 0.26);
    hubGrad.addColorStop(0, '#2a2048');
    hubGrad.addColorStop(1, '#0a0614');
    ctx.beginPath();
    ctx.arc(CX, CX, R * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffe14d';
    ctx.shadowColor = '#ffe14d';
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (lastWin != null) {
      ctx.font = '800 34px Bungee, Inter, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lastWin + '\u00D7', CX, CX + 2);
    }

    // pointer
    drawPointer(pointerLock.x, pointerLock.y);
  }

  function drawPointer(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0);
    ctx.fillStyle = '#ff3b5c';
    ctx.shadowColor = '#ff3b5c';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(10, -6);
    ctx.lineTo(0, -2);
    ctx.lineTo(-10, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function settle(index) {
    return { index, mult: SLICES[index].m };
  }

  async function spinWheel() {
    if (spinning) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    setMsg('Spinning…');
    spinning = true;

    const target = weight();
    // find a slot with that mult
    const slots = SLICES.map((s, i) => ({ s, i })).filter((o) => o.s.m === target);
    const targetIdx = slots[rand(slots.length)].i;

    const dur = reduced ? 500 : 4300 + Math.random() * 900;
    const startRot = rot;
    const deltaRot = (Math.PI * 2) * (7 + rand(3)) + (targetIdx * STEP - ((startRot % (Math.PI * 2)) + STEP * targetIdx));

    const easeOut = (p) => 1 - Math.pow(1 - p, 3);
    const t0 = performance.now();
    let resolved = null;

    const anim = new Promise((res) => { resolved = res; });
    const frame = (ts) => {
      const p = Math.min(1, (ts - t0) / dur);
      rot = startRot + deltaRot * easeOut(p);
      if (p < 1) {
        if (Math.floor(rot / STEP) % 2 === 0) { /* tick sfx near end handled by interval below */ }
        drawWheel();
        requestAnimationFrame(frame);
      } else {
        const o = settle(targetIdx);
        lastWin = o.mult;
        drawWheel();
        resolved(o);
      }
    };

    // ticking sfx simulated via interval
    const ticker = setInterval(() => {
      if (spinning) SoundKit.sfx.card();
    }, 260);
    requestAnimationFrame(frame);

    const o = await anim;
    clearInterval(ticker);

    const won = bet * o.mult;
    bankroll += won;
    save();
    renderStats();

    if (o.mult === 1) {
      setMsg('Landed on 1\u00D7 — bet returned. House edge wins here.', 'push');
      SoundKit.sfx.push();
    } else {
      setMsg(`Landed on ${o.mult}\u00D7 — you win ${fmt(won)}!`, 'win');
      SoundKit.sfx.win();
    }
    spinning = false;

    if (bankroll < MIN_CHIP) setMsg('Low on credits — step over to a table to rebuy.', 'lose');
  }

  document.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => { setBet(Number(btn.dataset.chip)); SoundKit.sfx.chip(); });
  });
  els.spin.addEventListener('click', spinWheel);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); spinWheel(); }
  });

  renderStats();
  drawWheel();
})();