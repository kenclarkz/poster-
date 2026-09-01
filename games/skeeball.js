(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    roll: $('roll'),
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

  // Rings (three concentric circular holes near the back)
  const RING_X = [160, 480];       // two rows
  const RINGS = [
    { x: 200, y: 150, r: 30, pts: 50, color: '#ff3b5c' },
    { x: 440, y: 150, r: 30, pts: 30, color: '#ffe14d' },
    { x: 320, y: 250, r: 34, pts: 20, color: '#39d0ff' },
  ];
  const BALL_R = 9;

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let ball = null;
  let rolling = false;
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

  function drawLane() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a1330');
    grad.addColorStop(1, '#0a0616');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // lane boards
    ctx.strokeStyle = 'rgba(255,225,77,0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(80, H);
    ctx.lineTo(80, 90);
    ctx.lineTo(120, 60);
    ctx.moveTo(W - 80, H);
    ctx.lineTo(W - 80, 90);
    ctx.lineTo(W - 120, 60);
    ctx.stroke();

    // rings
    RINGS.forEach((r) => {
      ctx.save();
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.fillStyle = r.color;
      ctx.font = '800 20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.pts, r.x, r.y);
      ctx.restore();
    });

    // ball path trace
    if (path.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      path.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.stroke();
    }
  }

  function drawBall(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe14d';
    ctx.shadowColor = '#ffe14d';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  async function roll() {
    if (rolling) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    rolling = true;

    // launch from bottom center toward a random ring
    const aim = RINGS[rand(RINGS.length)];
    // higher-scoring rings are harder to hit exactly
    const precision = aim.pts >= 50 ? 12 : aim.pts >= 30 ? 18 : 26;
    ball = { x: W / 2, y: H - 30 };
    path = [ { x: ball.x, y: ball.y } ];

    const targetX = aim.x + rand(-6, 6);
    const targetY = aim.y + rand(-6, 6);
    const steps = 70;
    let cur = { x: ball.x, y: ball.y };
    let landed = false;
    let pts = 0;
    let target = null;

    for (let s = 1; s <= steps && !landed; s++) {
      const p = s / steps;
      const ease = 1 - Math.pow(1 - p, 2); // decelerating
      // add a wobble so the ball can drift off-center (miss risk)
      const wobbleX = (0.5 - Math.random()) * 2;
      const wobbleY = (0.5 - Math.random()) * 2;
      const x = ball.x + (targetX - ball.x) * ease + wobbleX * ease * 3;
      const y = ball.y - ((ball.y - targetY) * ease) + wobbleY * ease * 2;
      cur = { x, y };
      path.push({ x, y });
      if (path.length > 160) path.shift();
      drawLane();
      drawBall(x, y);
      await sleep(12);

      // check ring capture (only if the aim was decent enough)
      for (const r of RINGS) {
        const dx = x - r.x, dy = y - r.y;
        if (Math.hypot(dx, dy) < Math.max(4, r.r - precision * ease)) {
          pts = r.pts;
          target = r;
          landed = true;
          break;
        }
      }
    }

    // if no ring captured, it's a miss
    const won = pts * bet;
    const mult = (pts >= 50 ? 5 : pts >= 30 ? 3 : pts >= 20 ? 2 : pts >= 10 ? 1 : 0);
    const payout = bet * mult;
    bankroll += payout;
    save();
    renderStats();

    if (target) {
      ctx.save();
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      SoundKit.sfx.win();
      setMsg(`Landing the ${pts} ring — you win ${fmt(payout)}!`, 'win');
    } else {
      SoundKit.sfx.lose();
      setMsg('Roll missed every ring — no payout.', 'lose');
    }
    void won;

    await sleep(700);
    ball = null;
    path = [];
    rolling = false;
    if (bankroll < MIN_CHIP) setMsg('Low on credits — rebuy at a table.', 'lose');
  }

  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.addEventListener('click', () => { setBet(Number(b.dataset.chip)); SoundKit.sfx.chip(); });
  });
  els.roll.addEventListener('click', roll);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ') { e.preventDefault(); roll(); }
  });

  renderStats();
  drawLane();
})();