(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    drop: $('drop'),
    music: $('music-toggle'),
    canvas: $('game'),
  };

  const { fmt, loadBankroll, save, sleep, MIN_CHIP, DEFAULT_BANKROLL } = Arcade;

  const CV = els.canvas;
  const ctx = CV.getContext('2d');
  const W = CV.width;
  const H = CV.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  CV.width = W * dpr;
  CV.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const ROWS = 11;
  const COLS = 9;
  const TOP_Y = 80;
  const BALL_R = 8;
  const MARGIN = 50;
  const GAP_X = (W - MARGIN * 2) / (COLS - 1);
  const GAP_Y = 40;
  const SLOT_H = 52;

  const MULT = [3, 2, 1.5, 1, 0.5, 1, 1.5, 2, 3];

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let aimCol = 4;
  let ball = null;
  let dropping = false;
  let pegs = [];

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

  function buildPegs() {
    pegs = [];
    for (let r = 0; r < ROWS; r++) {
      const offset = (r % 2) * (GAP_X / 2);
      const cStart = r % 2 ? 1 : 0;
      const cEnd = r % 2 ? COLS - 1 : COLS;
      for (let c = cStart; c < cEnd; c++) {
        pegs.push({ x: MARGIN + c * GAP_X + offset, y: TOP_Y + r * GAP_Y, r: 4 });
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#14102e');
    grad.addColorStop(1, '#07050f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // slots
    for (let c = 0; c < COLS; c++) {
      const x = MARGIN + c * GAP_X;
      const m = MULT[c];
      const w = GAP_X - 12;
      ctx.fillStyle = m >= 3 ? '#ff3b5c' : m >= 2 ? '#ff2ec4' : m >= 1.5 ? '#ffe14d' : m >= 1 ? '#39d0ff' : '#39ff88';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - w / 2, TOP_Y + ROWS * GAP_Y, w, SLOT_H, 6) : ctx.rect(x - w / 2, TOP_Y + ROWS * GAP_Y, w, SLOT_H);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#120a02';
      ctx.font = '800 15px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m + '\u00D7', x, TOP_Y + ROWS * GAP_Y + SLOT_H / 2);
    }

    // pegs
    pegs.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,225,77,0.55)';
      ctx.fill();
    });

    // aim
    const dropX = MARGIN + aimCol * GAP_X;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(dropX, 0);
    ctx.lineTo(dropX, TOP_Y - 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(dropX, TOP_Y - 20);
    ctx.lineTo(dropX - 11, TOP_Y + 2);
    ctx.lineTo(dropX + 11, TOP_Y + 2);
    ctx.closePath();
    ctx.fill();

    if (ball) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = '#39ff88';
      ctx.shadowColor = '#39ff88';
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  async function drop() {
    if (dropping) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    dropping = true;

    ball = { x: MARGIN + aimCol * GAP_X, y: TOP_Y, vx: 0, vy: 0 };
    let slotCol = -1;

    for (let step = 0; step < 600; step++) {
      ball.vy += 0.16;
      ball.x += ball.vx;
      ball.y += ball.vy;

      for (const p of pegs) {
        const d = Math.hypot(ball.x - p.x, ball.y - p.y);
        if (d < BALL_R + p.r && d > 0.001) {
          ball.vx = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 0.6);
          ball.vy = -0.4 - Math.random() * 0.2;
          if (Math.random() < 0.6) SoundKit.sfx.card();
          break;
        }
      }

      if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }

      if (ball.y + BALL_R >= TOP_Y + ROWS * GAP_Y) {
        let bestCol = 0, bestDist = Infinity;
        for (let c = 0; c < COLS; c++) {
          const x = MARGIN + c * GAP_X;
          const d = Math.abs(ball.x - x);
          if (d < bestDist) { bestDist = d; bestCol = c; }
        }
        if (bestDist < GAP_X / 2) slotCol = bestCol;
        break;
      }

      draw();
      await sleep(8);
    }

    if (slotCol >= 0) {
      const mult = MULT[slotCol];
      const payout = Math.round(bet * mult);
      bankroll += payout;
      save();
      renderStats();
      setMsg(`Plinko landed on ${mult}\u00D7 — you win ${fmt(payout)}!`, 'win');
      SoundKit.sfx.win();
      await sleep(600);
    } else {
      setMsg('The ball slipped out. Try again.', 'lose');
      SoundKit.sfx.lose();
      await sleep(400);
    }

    ball = null;
    dropping = false;
    draw();
    if (bankroll < MIN_CHIP) setMsg('Low on credits — rebuy at a table.', 'lose');
  }

  function aimAt(col) {
    aimCol = Math.max(0, Math.min(COLS - 1, col));
    draw();
  }

  CV.addEventListener('pointerdown', (e) => {
    const rect = CV.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    aimAt(Math.round((x - MARGIN) / GAP_X));
  });

  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.addEventListener('click', () => { setBet(Number(b.dataset.chip)); SoundKit.sfx.chip(); });
  });
  els.drop.addEventListener('click', drop);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); drop(); }
    else if (e.key === 'ArrowLeft') aimAt(aimCol - 1);
    else if (e.key === 'ArrowRight') aimAt(aimCol + 1);
  });

  renderStats();
  buildPegs();
  draw();
})();