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

  const GRID = 3;
  const CELL_W = (W - 40) / GRID;
  const CELL_H = (H - 60) / GRID;
  const START_Y = 30;

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let cells = [];      // {row, col, x, y, active:{type,ttl}}
  let score = 0;
  let timeLeft = 30;
  let running = false;
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

  function initCells() {
    cells = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const cx = 20 + c * CELL_W + CELL_W / 2;
        const cy = START_Y + r * CELL_H + CELL_H / 2;
        cells.push({ row: r, col: c, x: cx, y: cy, active: null });
      }
    }
  }

  function spawn() {
    const empty = cells.filter((c) => !c.active);
    if (!empty.length) return;
    const cell = empty[rand(empty.length)];
    const gold = Math.random() < 0.12;
    const bomb = !gold && Math.random() < 0.18;
    cell.active = { type: bomb ? 'bomb' : gold ? 'gold' : 'mole', ttl: 40 + rand(50) };
    if (bomb) SoundKit.sfx.push(); else SoundKit.sfx.card();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#14302a');
    grad.addColorStop(1, '#06110f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    cells.forEach((cell) => {
      // hole
      ctx.beginPath();
      ctx.ellipse(cell.x, cell.y + CELL_H / 4 - 8, CELL_W * 0.32, CELL_W * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0a050f';
      ctx.fill();

      if (cell.active) {
        const a = cell.active;
        const y = cell.y - CELL_H * 0.25;
        if (a.type === 'bomb') {
          ctx.beginPath();
          ctx.arc(cell.x, y, 26, 0, Math.PI * 2);
          ctx.fillStyle = '#1a1a1a';
          ctx.shadowColor = '#ff3b5c';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fff';
          ctx.font = '800 30px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', cell.x, y);
        } else {
          // mole body
          ctx.fillStyle = a.type === 'gold' ? '#ffe14d' : '#8a5a2b';
          ctx.shadowColor = a.type === 'gold' ? '#ffb300' : 'transparent';
          ctx.shadowBlur = a.type === 'gold' ? 14 : 0;
          ctx.beginPath();
          ctx.arc(cell.x, y, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#2a1a0a';
          ctx.beginPath();
          ctx.arc(cell.x - 8, y - 4, 4, 0, Math.PI * 2);
          ctx.arc(cell.x + 8, y - 4, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }

  function whack(x, y) {
    if (!running) return;
    const cell = cells.find((c) => x >= c.x - CELL_W / 2 && x <= c.x + CELL_W / 2 && y >= c.y - CELL_H / 2 && y <= c.y + CELL_H / 2);
    if (!cell || !cell.active) return;

    const a = cell.active;
    cell.active = null;
    if (a.type === 'bomb') {
      score = Math.max(0, score - 3);
      els.score.textContent = score;
      setMsg('BOMB! You lose 3 moles.', 'lose');
      SoundKit.sfx.lose();
    } else if (a.type === 'gold') {
      score += 5;
      els.score.textContent = score;
      setMsg('Gold mole! +5 moles.', 'win');
      SoundKit.sfx.win();
    } else {
      score++;
      els.score.textContent = score;
      setMsg('Whacked a mole!', 'win');
      SoundKit.sfx.chip();
    }
    draw();
  }

  async function start() {
    if (running) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    score = 0;
    timeLeft = 30;
    running = true;
    els.score.textContent = '0';
    els.time.textContent = timeLeft;
    setMsg('Whack those moles!');

    const t0 = performance.now();
    let lastTick = t0;
    while (timeLeft > 0 && running) {
      const now = performance.now();
      if (now - lastSpawn > 520) { spawn(); lastSpawn = now; }
      // decrement ttl
      for (const cell of cells) {
        if (cell.active) {
          cell.active.ttl--;
          if (cell.active.ttl <= 0) cell.active = null;
        }
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

    // payout: each mole = 1 unit of bet, gold counted as multiple
    const payout = bet * score;
    bankroll += payout;
    save();
    renderStats();

    if (payout > 0) {
      setMsg(`Round over! ${score} moles — you win ${fmt(payout)}!`, 'win');
      SoundKit.sfx.win();
    } else {
      setMsg(`Round over. No moles whacked.`, 'lose');
      SoundKit.sfx.lose();
    }
  }

  CV.addEventListener('pointerdown', (e) => {
    const rect = CV.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    whack(x, y);
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
  initCells();
  draw();
})();