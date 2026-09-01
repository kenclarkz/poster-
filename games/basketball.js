(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    shoot: $('shoot'),
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

  const HOOP = { x: 470, y: 170, r: 40 };
  const PLAYER = { x: 110, y: H - 40 };

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let power = 0;          // 0..1 visual meter
  let meterRising = true;
  let shooting = false;
  let ball = null;        // {x, y, vx, vy}
  let path = [];

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

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d1b2a');
    grad.addColorStop(1, '#050810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCourt() {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(HOOP.x, HOOP.y + 60, 120, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  function drawHoop() {
    ctx.strokeStyle = '#ff3b5c';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ff3b5c';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(HOOP.x, HOOP.y, HOOP.r, Math.PI, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // backboard
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(HOOP.x - 4, HOOP.y - HOOP.r - 40, 8, HOOP.r + 20);
    // net
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(HOOP.x + HOOP.r * 0.9 * Math.cos(a), HOOP.y + HOOP.r * 0.5 * Math.sin(a));
      ctx.lineTo(HOOP.x + (i - 2) * 8, HOOP.y + HOOP.r + 26);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    ctx.fillStyle = '#39ff88';
    ctx.beginPath();
    ctx.arc(PLAYER.x, PLAYER.y - 14, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#39ff88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(PLAYER.x, PLAYER.y - 2);
    ctx.lineTo(PLAYER.x, PLAYER.y - 34);
    ctx.moveTo(PLAYER.x, PLAYER.y - 24);
    ctx.lineTo(PLAYER.x + 16, PLAYER.y - 30);
    ctx.stroke();
  }

  function drawMeter() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(30, H - 60, 200, 22);
    const w = 200 * power;
    const grad = ctx.createLinearGradient(30, 0, 230, 0);
    grad.addColorStop(0, '#39ff88');
    grad.addColorStop(0.85, '#ffe14d');
    grad.addColorStop(1, '#ff3b5c');
    ctx.fillStyle = grad;
    ctx.fillRect(30, H - 60, w, 22);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, H - 60, 200, 22);
    // sweet spot
    ctx.fillStyle = '#fff';
    ctx.fillRect(30 + 200 * 0.78, H - 62, 8, 26);
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'left';
    ctx.fillText('SWISH', 240, H - 49);
  }

  function drawBall(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#ff8c42';
    ctx.shadowColor = '#ff8c42';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#3a1f10';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 11, y);
    ctx.lineTo(x + 11, y);
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x, y + 11);
    ctx.stroke();
  }

  function frame() {
    // power meter animation
    if (!shooting) {
      if (meterRising) {
        power += 0.012;
        if (power >= 1) meterRising = false;
      } else {
        power -= 0.012;
        if (power <= 0) meterRising = true;
      }
    }
    drawBackground();
    drawCourt();
    drawHoop();
    drawPlayer();
    if (shooting && ball) {
      drawBall(ball.x, ball.y);
    }
    drawMeter();
    requestAnimationFrame(frame);
  }

  async function shoot() {
    if (shooting) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }

    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    shooting = true;

    // Projectile throw from the player up and into the hoop.
    // Constants are tuned so a sweet-spot release (power ≈ 0.78) swishes.
    const error = power - 0.78;              // 0 at the sweet spot
    const g = 0.2;
    const N = 80;                            // frames in flight
    const vx = (HOOP.x - PLAYER.x) / N + error * 9;   // error pushes the shot wide
    const vy0 = (HOOP.y - (PLAYER.y - 40) - 0.5 * g * N * N) / N;
    ball = { x: PLAYER.x, y: PLAYER.y - 40, vx, vy: vy0, t: 0 };
    path = [];

    let landed = false;
    let result = null;

    for (let frame = 1; frame <= 160 && !landed; frame++) {
      ball.y += ball.vy;
      ball.vy += g;
      ball.x += ball.vx;
      path.push({ x: ball.x, y: ball.y });
      if (path.length > 90) path.shift();

      if (ball.x >= HOOP.x - HOOP.r && ball.x <= HOOP.x + HOOP.r && Math.abs(ball.y - HOOP.y) < 38) {
        const absErr = Math.abs(error);
        result = absErr < 0.05 ? 'swish' : absErr < 0.16 ? 'make' : 'clank';
        landed = true;
      }
      if (ball.y > H - 20 || ball.x > W + 30 || ball.x < -20) {
        result = result || 'miss';
        landed = true;
      }
      drawBackground(); drawCourt(); drawHoop(); drawPlayer(); drawBall(ball.x, ball.y);
      await sleep(12);
    }
    if (!landed) result = result || 'miss';

    const won = result === 'swish' ? bet * 3 : result === 'make' ? bet * 2 : 0;
    bankroll += won;
    save();
    renderStats();

    if (result === 'swish') { setMsg(`Swish! Clean release — you win ${fmt(won)}!`, 'win'); SoundKit.sfx.win(); }
    else if (result === 'make') { setMsg(`Good shot — you win ${fmt(won)}!`, 'win'); SoundKit.sfx.chip(); }
    else if (result === 'clank') { setMsg('Clank. Off the rim — no payout.', 'lose'); SoundKit.sfx.lose(); }
    else { setMsg('Air ball. Missed entirely.', 'lose'); SoundKit.sfx.lose(); }

    await sleep(650);
    ball = null;
    path = [];
    shooting = false;
    if (bankroll < MIN_CHIP) setMsg('Low on credits — rebuy at a table.', 'lose');
  }

  document.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => { setBet(Number(btn.dataset.chip)); SoundKit.sfx.chip(); });
  });
  els.shoot.addEventListener('click', shoot);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ') { e.preventDefault(); shoot(); }
  });

  renderStats();
  requestAnimationFrame(frame);
})();