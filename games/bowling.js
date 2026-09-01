(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    left: $('left'),
    right: $('right'),
    roll: $('roll'),
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

  const LANE_CENTER = W / 2;
  const PINS_Y = 120;
  const PIN_R = 12;
  const BALL_R = 13;
  const BALL_Y = H - 90;

  // pin layout (standard triangle, 4 rows)
  const PIN_LAYOUT = [];
  const rowSpacing = 26;
  const startCol = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const x = LANE_CENTER + (col - row / 2) * rowSpacing;
      const y = PINS_Y + row * 14;
      PIN_LAYOUT.push({ x, y, up: true });
    }
  }

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let aim = 0;          // -1..1
  let power = 0;
  let meterRising = true;
  let pins = [];
  let ball = null;
  let rolling = false;
  let gutter = null;

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
  function resetPins() {
    pins = PIN_LAYOUT.map((p) => ({ x: p.x, y: p.y, up: true }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a2350');
    grad.addColorStop(1, '#0a0c20');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // lane
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(LANE_CENTER - 90, 40, 180, H - 40);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(LANE_CENTER - 90, 40, 180, H - 40);

    // pins
    pins.forEach((p) => {
      if (!p.up) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(0);
      ctx.beginPath();
      ctx.arc(0, 0, PIN_R, 0, Math.PI * 2);
      ctx.fillStyle = '#f4e9c8';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ff3b5c';
      ctx.font = '800 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('■', 0, 0);
      ctx.restore();
    });

    // aim guide
    const aimX = LANE_CENTER + aim * 80;
    ctx.strokeStyle = 'rgba(255,225,77,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(BALL_Y, BALL_Y);
    ctx.lineTo(aimX, 180);
    ctx.stroke();
    ctx.setLineDash([]);

    // ball
    if (ball) {
      drawBall(ball.x, ball.y);
    } else {
      ctx.beginPath();
      ctx.arc(aimX, BALL_Y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe14d';
      ctx.shadowColor = '#ffe14d';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // power meter
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(30, 420, 220, 24);
    const pw = 220 * power;
    const pg = ctx.createLinearGradient(30, 0, 250, 0);
    pg.addColorStop(0, '#39ff88');
    pg.addColorStop(1, '#ff3b5c');
    ctx.fillStyle = pg;
    ctx.fillRect(30, 420, pw, 24);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(30, 420, 220, 24);
    // sweet spot
    ctx.fillStyle = '#fff';
    ctx.fillRect(30 + 220 * 0.8, 418, 8, 28);
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'left';
    ctx.fillText('POWER', 30, 406);
  }

  function drawBall(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe14d';
    ctx.shadowColor = '#ffe14d';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function frame() {
    if (!rolling) {
      if (meterRising) { power += 0.014; if (power >= 1) meterRising = false; }
      else { power -= 0.014; if (power <= 0) meterRising = true; }
    }
    draw();
    requestAnimationFrame(frame);
  }

  function aimDir(dir) {
    if (rolling) return;
    aim = Math.max(-1, Math.min(1, aim + dir * 0.2));
    SoundKit.sfx.card();
    draw();
  }

  async function roll() {
    if (rolling) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    rolling = true;

    // accuracy: sweet spot at power 0.8
    const targetX = LANE_CENTER + aim * 70;
    const speed = (5 + power * 6) * 2;
    ball = { x: LANE_CENTER + aim * 70, y: BALL_Y, vx: 0, vy: -speed, n: 0 };
    let pinsKnocked = [];

    while (ball.y > 60 && pins.some((p) => p.up)) {
      // slight drift from aim
      ball.vy += 0;
      ball.y += ball.vy;

      // pin collisions
      for (const p of pins) {
        if (!p.up) continue;
        if (Math.hypot(ball.x - p.x, ball.y - p.y) < BALL_R + PIN_R) {
          p.up = false;
          pinsKnocked.push(p);
          // deflect ball slightly
          ball.x += (ball.x - p.x) * 0.02;
          SoundKit.sfx.card();
        }
      }
      draw();
      await sleep(16);
    }
    await sleep(300);

    const knocked = pinsKnocked.length;
    const mult = knocked >= 10 ? 3 : knocked >= 4 ? 2 : knocked >= 2 ? 1.5 : knocked >= 1 ? 1 : 0;
    const payout = Math.round(bet * mult);
    bankroll += payout;
    save();
    renderStats();

    if (knocked >= 10) { setMsg(`STRIKE! All 10 pins — you win ${fmt(payout)}!`, 'win'); SoundKit.sfx.win(); }
    else if (knocked >= 4) { setMsg(`${knocked} pins down — you win ${fmt(payout)}!`, 'win'); SoundKit.sfx.win(); }
    else if (knocked >= 1) { setMsg(`${knocked} pins down — you win ${fmt(payout)}.`, 'push'); SoundKit.sfx.push(); }
    else { setMsg('Gutter ball — no pins down.', 'lose'); SoundKit.sfx.lose(); }

    await sleep(800);
    ball = null;
    resetPins();
    rolling = false;
    if (bankroll < MIN_CHIP) setMsg('Low on credits — rebuy at a table.', 'lose');
  }

  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.addEventListener('click', () => { setBet(Number(b.dataset.chip)); SoundKit.sfx.chip(); });
  });
  els.left.addEventListener('click', () => aimDir(-1));
  els.right.addEventListener('click', () => aimDir(1));
  els.roll.addEventListener('click', roll);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'ArrowLeft') aimDir(-1);
    else if (e.key === 'ArrowRight') aimDir(1);
    else if (e.key === ' ') { e.preventDefault(); roll(); }
  });

  renderStats();
  resetPins();
  requestAnimationFrame(frame);
})();