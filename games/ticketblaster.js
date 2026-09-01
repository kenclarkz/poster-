(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    score: $('score'),
    time: $('time'),
    start: $('start'),
    music: $('music-toggle'),
    canvas: $('game'),
  };

  const { fmt, loadBankroll, save, sleep, rand, MIN_CHIP, DEFAULT_BANKROLL } = Arcade;

  const CV = els.canvas;
  const ctx = CV.getContext('2d');
  const W = CV.width;
  const H = CV.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  CV.width = W * dpr;
  CV.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let tickets = [];
  let score = 0;
  let timeLeft = 60;
  let running = false;
  let pointer = { x: -100, y: -100, active: false };
  let lastSpawn = 0;

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

  function spawn() {
    const gold = Math.random() < 0.12;
    tickets.push({
      x: rand(W),
      y: -20 - rand(60),
      vx: rand(-1.4, 1.4),
      vy: 1 + Math.random() * 2,
      w: 46,
      h: 28,
      gold,
      rot: rand(-0.4, 0.4),
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#150f28');
    grad.addColorStop(1, '#080511');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    tickets.forEach((t) => {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      roundedRect(-t.w / 2, -t.h / 2, t.w, t.h, 6);
      ctx.fillStyle = t.gold ? '#ffe14d' : '#f4e9c8';
      ctx.shadowColor = t.gold ? '#ffb300' : '#ffffff';
      ctx.shadowBlur = t.gold ? 14 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = t.gold ? '#7a5000' : '#6d6858';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TICKET', 0, -8);
      ctx.fillStyle = t.gold ? '#3a2500' : '#8a1f1f';
      ctx.fillText('$' + bet, 0, 9);
      ctx.restore();
    });

    // pointer burst
    if (pointer.active) {
      const p = pointer;
      const age = (performance.now() - p.t) / 400;
      if (age < 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 + age * 40, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,225,77,' + (1 - age) + ')';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function blast(x, y) {
    if (!running) return;
    pointer = { x, y, active: true, t: performance.now() };
    for (let i = tickets.length - 1; i >= 0; i--) {
      const t = tickets[i];
      if (x >= t.x - t.w / 2 && x <= t.x + t.w / 2 && y >= t.y - t.h / 2 && y <= t.y + t.h / 2) {
        const amt = t.gold ? bet * 5 : bet;
        score += t.gold ? 5 : 1;
        bankroll += amt;
        tickets.splice(i, 1);
        els.score.textContent = score;
        renderStats();
        SoundKit.sfx.chip();
        setMsg(`Blasted ${t.gold ? 'a GOLD ticket worth ' + fmt(amt) : 'a ticket worth ' + fmt(amt)}!`, 'win');
      }
    }
    save();
  }

  async function start() {
    if (running) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    tickets = [];
    score = 0;
    timeLeft = 60;
    running = true;
    els.time.textContent = timeLeft;
    els.score.textContent = '0';
    setMsg('Blast those tickets!');

    const startTime = performance.now();
    let lastTick = startTime;
    while (timeLeft > 0 && running) {
      const now = performance.now();
      if (now - lastSpawn > 500) { spawn(); lastSpawn = now; }
      // update tickets
      for (let i = tickets.length - 1; i >= 0; i--) {
        const t = tickets[i];
        t.x += t.vx;
        t.y += t.vy;
        t.rot += 0.01;
        if (t.y > H + 30 || t.x < -50 || t.x > W + 50) tickets.splice(i, 1);
      }
      if (now - lastTick > 1000) {
        timeLeft--;
        els.time.textContent = timeLeft;
        lastTick = now;
        if (timeLeft <= 5) SoundKit.sfx.card();
      }
      draw();
      await sleep(16);
    }
    running = false;
    setMsg(`Round over! You collected ${score} ticket${score === 1 ? '' : 's'}.`, score >= 4 ? 'win' : 'push');
    if (score >= 4) SoundKit.sfx.win();
    else SoundKit.sfx.push();
  }

  CV.addEventListener('pointerdown', (e) => {
    const rect = CV.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    blast(x, y);
  });

  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.addEventListener('click', () => { setBet(Number(b.dataset.chip)); SoundKit.sfx.chip(); });
  });
  els.start.addEventListener('click', start);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ') { e.preventDefault(); start(); }
  });

  renderStats();
  draw();
})();