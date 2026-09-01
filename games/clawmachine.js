(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    left: $('left'),
    right: $('right'),
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

  const CLAW_X_MIN = 40;
  const CLAW_X_MAX = W - 40;
  const CLAW_TOP = 60;
  const PLAFORM_Y = 300;

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let clawX = W / 2;
  let clawY = CLAW_TOP;
  let clawState = 'idle'; // idle | down | grab | up
  let prizes = [];
  let holding = null;

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

  function spawnPrizes() {
    prizes = [];
    const cols = 6;
    for (let i = 0; i < cols; i++) {
      const val = bet * (2 + rand(9)); // 2x..10x
      prizes.push({
        x: 60 + i * ((W - 120) / (cols - 1)),
        y: PLAFORM_Y - 10,
        w: 42,
        h: 34,
        val,
        color: ['#ffe14d', '#ff2ec4', '#39d0ff', '#39ff88'][rand(4)],
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // machine body
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#24163f');
    grad.addColorStop(1, '#0a0514');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // glass
    ctx.fillStyle = 'rgba(120,200,255,0.05)';
    ctx.fillRect(0, CLAW_TOP, W, PLAFORM_Y - CLAW_TOP);

    // platform
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, PLAFORM_Y, W, 40);

    // prizes
    prizes.forEach((p) => {
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.color;
      roundedRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#120a02';
      ctx.font = '800 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$' + p.val, p.x, p.y);
      ctx.restore();
    });

    // rail
    ctx.fillStyle = 'rgba(255,225,77,0.7)';
    ctx.fillRect(0, CLAW_TOP - 4, W, 5);

    // claw head
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(clawX, clawY);
    ctx.lineTo(clawX, clawY + 24);
    ctx.stroke();
    // claw fingers
    const spread = 16;
    ctx.beginPath();
    ctx.moveTo(clawX, clawY + 24);
    ctx.lineTo(clawX - spread, clawY + 44);
    ctx.moveTo(clawX, clawY + 24);
    ctx.lineTo(clawX + spread, clawY + 44);
    ctx.stroke();

    // holding prize
    if (holding) {
      ctx.fillStyle = holding.color;
      roundedRect(holding.x - holding.w / 2, clawY + 46, holding.w, holding.h, 8);
      ctx.fill();
      ctx.fillStyle = '#120a02';
      ctx.fillText('$' + holding.val, holding.x, clawY + 46 + holding.h / 2);
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

  function move(dir) {
    if (clawState !== 'idle') return;
    clawX = Math.max(CLAW_X_MIN, Math.min(CLAW_X_MAX, clawX + dir * 12));
    SoundKit.sfx.card();
    draw();
  }

  async function drop() {
    if (clawState !== 'idle') return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    setMsg('Claw descending…');
    clawState = 'down';

    // descend
    while (clawY < PLAFORM_Y - 10) {
      clawY += 5;
      draw();
      await sleep(12);
    }

    // grab: find a prize under the claw
    const under = prizes.find((p) => Math.abs(p.x - clawX) < p.w);
    holding = under || null;

    // loose claw: only ~35% grab chance unless perfectly aligned
    if (holding && Math.random() < 0.4) {
      holding = null;
      setMsg('The claw slips away…', 'lose');
      SoundKit.sfx.lose();
    } else if (holding) {
      prizes = prizes.filter((p) => p !== holding);
      SoundKit.sfx.card();
      setMsg('Got it! Claw rising…', 'push');
    } else {
      setMsg('Grabbed empty air.', 'lose');
      SoundKit.sfx.lose();
    }

    clawState = 'grab';
    // rise
    while (clawY > CLAW_TOP) {
      clawY -= 4;
      draw();
      await sleep(10);
    }
    clawState = 'up';
    draw();

    if (holding) {
      const won = holding.val;
      bankroll += won;
      save();
      renderStats();
      setMsg(`Captured a ${fmt(won)} prize!`, 'win');
      SoundKit.sfx.win();
      holding = null;
    }

    await sleep(500);
    clawY = CLAW_TOP;
    clawState = 'idle';
    draw();
    if (bankroll < MIN_CHIP) setMsg('Low on credits — rebuy at a table.', 'lose');
  }

  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.addEventListener('click', () => { setBet(Number(b.dataset.chip)); SoundKit.sfx.chip(); spawnPrizes(); draw(); });
  });
  els.left.addEventListener('click', () => move(-1));
  els.right.addEventListener('click', () => move(1));
  els.drop.addEventListener('click', drop);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'a' || e.key === 'ArrowLeft') move(-1);
    else if (k === 'd' || e.key === 'ArrowRight') move(1);
    else if (e.key === ' ') { e.preventDefault(); drop(); }
  });

  renderStats();
  spawnPrizes();
  draw();
})();