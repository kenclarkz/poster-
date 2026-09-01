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

  const { fmt, loadBankroll, save, sleep, rand, MIN_CHIP, DEFAULT_BANKROLL } = Arcade;

  const CV = els.canvas;
  const ctx = CV.getContext('2d');
  const W = CV.width;
  const H = CV.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  CV.width = W * dpr;
  CV.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const ROWS = 8;
  const PEG_GAP = 46;
  const TOP_Y = 70;
  const BALL_R = 9;

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let aimX = W / 2;
  let ball = null;
  let dropping = false;
  let pegs = [];

  const SLOTS = [
    { x: 0, y: H - 66, mult: 12, color: '#ff3b5c' },
    { x: W / 2, y: H - 66, mult: 6, color: '#ffe14d' },
    { x: W - 0, y: H - 66, mult: 12, color: '#ff3b5c' },
  ];

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
      const offset = (r % 2) * (PEG_GAP / 2);
      const count = Math.floor(W / PEG_GAP) - 1;
      for (let c = 0; c < count; c++) {
        pegs.push({
          x: 40 + c * PEG_GAP + offset,
          y: TOP_Y + r * PEG_GAP * 0.7,
          r: 4,
        });
      }
    }
  }

  function drawBall(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3b5c';
    ctx.shadowColor = '#ff3b5c';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8a1f1f';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a1040');
    grad.addColorStop(1, '#0a0414');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // pegs
    pegs.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,225,77,0.6)';
      ctx.shadowColor = '#ffe14d';
      ctx.shadowBlur = 6;
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // slots
    SLOTS.forEach((s) => {
      const w = 170;
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(s.x - w / 2, s.y, w, 40, 10) : ctx.rect(s.x - w / 2, s.y, w, 40);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#120a02';
      ctx.font = '800 15px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.x === W / 2 ? 'BIG ' + s.mult + '\u00D7' : 'JACKPOT ' + s.mult + '\u00D7', s.x, s.y + 20);
    });

    // aim indicator
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(aimX, 0);
    ctx.lineTo(aimX, TOP_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(aimX, TOP_Y - 6);
    ctx.lineTo(aimX - 12, TOP_Y + 14);
    ctx.lineTo(aimX + 12, TOP_Y + 14);
    ctx.closePath();
    ctx.fill();

    if (ball) drawBall(ball.x, ball.y);
  }

  function pointerOffset(x) {
    return Math.random() < 0.5 ? -1 : 1;
  }

  async function drop() {
    if (dropping) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    dropping = true;
    setMsg('Gem dropping…');

    ball = { x: aimX, y: TOP_Y, vx: 0, vy: 0 };
    let landed = null;

    for (let step = 0; step < 400; step++) {
      ball.vy += 0.22;
      ball.x += ball.vx;
      ball.y += ball.vy;

      // peg collisions
      for (const p of pegs) {
        const d = Math.hypot(ball.x - p.x, ball.y - p.y);
        if (d < BALL_R + p.r && d > 0.001) {
          // deflect
          ball.vx = pointerOffset(p.x) * (1 + Math.random() * 0.8);
          ball.vy = -0.5 - Math.random() * 0.3;
          ball.x += ball.vx * 2;
          ball.y -= 2;
          if (Math.random() < 0.5) SoundKit.sfx.card();
          break;
        }
      }

      // wall bounce
      if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }

      // check slot landing
      if (ball.y + BALL_R >= H - 40) {
        let best = null;
        for (const s of SLOTS) {
          if (Math.abs(ball.x - s.x) < 85) best = s;
        }
        if (best) {
          landed = best;
          ball.x = best.x;
        } else {
          // fell into dead gap between slots -> vanish
          landed = null;
        }
        break;
      }

      draw();
      await sleep(8);
    }

    if (landed) {
      const payout = bet * landed.mult;
      bankroll += payout;
      save();
      renderStats();
      setMsg(`Landed in the ${landed.x === W / 2 ? 'BIG' : 'JACKPOT'} slot — you win ${fmt(payout)}!`, 'win');
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 24;
      ctx.fillStyle = landed.color;
      ctx.beginPath();
      ctx.arc(landed.x, H - 48, 30 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      SoundKit.sfx.win();
      await sleep(400);
    } else {
      setMsg('The gem tumbled into a dead end. Try again.', 'lose');
      SoundKit.sfx.lose();
      await sleep(400);
    }

    ball = null;
    dropping = false;
    draw();
    if (bankroll < MIN_CHIP) setMsg('Low on credits — rebuy at a table.', 'lose');
  }

  CV.addEventListener('pointerdown', (e) => {
    const rect = CV.getBoundingClientRect();
    aimX = Math.max(45, Math.min(W - 45, (e.clientX - rect.left) * (W / rect.width)));
    draw();
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
    else if (e.key === 'ArrowLeft') { aimX = Math.max(45, aimX - 20); draw(); }
    else if (e.key === 'ArrowRight') { aimX = Math.min(W - 45, aimX + 20); draw(); }
  });

  renderStats();
  buildPegs();
  draw();
})();