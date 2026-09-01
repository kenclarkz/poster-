(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    jackpot: $('jackpot'),
    drop: $('drop'),
    newRound: $('new-round'),
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

  const LEDGE_Y = 250;
  const DROP_X = W / 2;

  const COIN_R = 10;
  const PRIZE_W = 26;
  const PRIZE_H = 30;

  const LANE_COLORS = ['#ffe14d', '#ff2ec4', '#39d0ff', '#39ff88'];

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let coins = [];          // coins resting on the ledge
  let prizes = [];         // prizes on the ledge
  let falling = null;      // coin currently dropping
  let putCoins = 0;
  let phase = 'idle';
  let jackpot = 0;

  function initPrizes() {
    prizes = [];
    const N = 5;
    const step = 84;
    const startX = W / 2 - ((N - 1) * step) / 2;
    for (let i = 0; i < N; i++) {
      const isJackpot = i === 0 || i === 4;
      const val = isJackpot ? Math.floor(50 * rand(9) + 50) : 10 + rand(40);
      prizes.push({
        x: startX + i * step,
        y: LEDGE_Y + 28,
        w: PRIZE_W,
        h: PRIZE_H,
        val,
        color: isJackpot ? '#ffd94a' : LANE_COLORS[i % LANE_COLORS.length],
        jackpotPrize: isJackpot,
        gold: isJackpot,
      });
    }
  }

  function renderStats() {
    els.bankroll.textContent = fmt(bankroll);
    els.bet.textContent = fmt(bet);
    els.jackpot.textContent = fmt(jackpot);
  }

  function setMsg(text, cls = '') {
    els.message.textContent = text;
    els.message.className = 'message' + (cls ? ' ' + cls : '');
  }

  function setBet(v) {
    bet = Math.max(5, Math.min(v, bankroll));
    renderStats();
  }

  function drawMachine(bg) {
    ctx.clearRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a1330');
    grad.addColorStop(1, '#05030c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, 40, 10, W / 2, 40, 200);
    glow.addColorStop(0, 'rgba(255,225,77,0.14)');
    glow.addColorStop(1, 'rgba(255,225,77,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // back panel
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, W, LEDGE_Y + 40);

    // lanes shading
    for (let lx = 0; lx < W; lx += 40) {
      ctx.fillStyle = (lx / 40) % 2 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(lx, 0, 40, LEDGE_Y + 40);
    }

    // jackpot banner
    ctx.textAlign = 'center';
    ctx.font = '700 15px Inter, sans-serif';
    ctx.fillStyle = '#ffe14d';
    ctx.shadowColor = '#ffb300';
    ctx.shadowBlur = 12;
    ctx.fillText('PUSH THE LEDGE — GRAB THE JACKPOT', W / 2, 30);
    ctx.shadowBlur = 0;

    // prizes
    prizes.forEach((p) => {
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.globalCompositeOperation = 'lighter';
      roundedRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 6);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#120a02';
      ctx.font = '700 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$' + p.val, p.x, p.y + 5);
      ctx.restore();
    });

    // ledge platform
    ctx.fillStyle = 'rgba(255,225,77,0.75)';
    ctx.fillRect(0, LEDGE_Y + 40, W, 6);

    // coins on ledge
    coins.forEach((c) => drawCoin(c.x, c.y, c.n));

    if (falling) drawCoin(falling.x, falling.y, falling.n);

    // base
    ctx.fillStyle = '#171234';
    ctx.fillRect(0, H - 44, W, 44);

    // controls label
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillText('DROP ZONE', DROP_X, LEDGE_Y + 20);
  }

  function drawCoin(x, y, n) {
    ctx.beginPath();
    ctx.arc(x, y, COIN_R, 0, Math.PI * 2);
    ctx.fillStyle = n % 2 ? '#ffd54a' : '#ffeaa0';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, COIN_R - 4, 0, Math.PI * 2);
    ctx.strokeStyle = n % 3 ? '#b8860b' : '#80520b';
    ctx.lineWidth = 1;
    ctx.stroke();
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

  function coinsInLane(startX, endX) {
    return coins.filter((c) => c.x >= startX && c.x <= endX).length;
  }

  function degrees(x) {
    if (x < 100) return 0.15;
    if (x < 260) return 0.0;
    if (x < 420) return -0.15;
    return 0.15;
  }

  async function dropCoin() {
    if (phase !== 'idle' || falling) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    putCoins++;
    SoundKit.sfx.chip();
    setMsg('Coin dropping…');

    falling = { x: DROP_X, y: 60, n: putCoins };
    phase = 'dropping';
    drawMachine();

    while (falling.y < LEDGE_Y - COIN_R) {
      falling.y += 7;
      drawMachine();
      await sleep(14);
    }

    // puls
    const c = { x: DROP_X + rand(-8, 8), y: LEDGE_Y + 10, n: putCoins };
    falling = null;
    coins.push(c);
    phase = 'pushing';

    // push effect: move existing coins, drifting by lane slope
    let moved = true;
    let pushed = 0;
    for (let k = 0; k < 14 && moved; k++) {
      moved = false;
      for (let i = 0; i < coins.length; i++) {
        const drift = degrees(c.x); // whole-lane push
        coins[i].x += drift;
        if (k === 0 && coins[i].x > c.x - COIN_R && coins[i].x < c.x + COIN_R) { pushed++; }
        if (coins[i].x - COIN_R < 0 || coins[i].x + COIN_R > W) {
          // edge coin falls off -> payout
          const kicked = coins.splice(i, 1)[0];
          payOut(kicked);
          moved = true;
          i--;
        } else if (drift !== 0) {
          moved = true;
        }
      }
    }
    SoundKit.sfx.card();
    drawMachine();
    await sleep(300);

    // check prize push (prizes move with drift too)
    for (let i = prizes.length - 1; i >= 0; i--) {
      const p = prizes[i];
      p.x += degrees(p.x);
      if (p.x - p.w / 2 < 0 || p.x + p.w / 2 > W) {
        const pri = prizes.splice(i, 1)[0];
        const amt = pri.val;
        bankroll += amt;
        jackpot += amt;
        save();
        renderStats();
        setMsg(`You knocked off a ${pri.gold ? 'GOLD ' : ''}prize worth ${fmt(amt)}!`, 'win');
        SoundKit.sfx.win();
        await sleep(650);
        phase = 'idle';
        drawMachine();
        return;
      }
    }

    if (bankroll < MIN_CHIP) {
      setMsg('You ran out of credits. Rebuy from the table games.', 'lose');
      phase = 'idle';
    } else {
      setMsg('Nice push! Drop another coin.', 'push');
      phase = 'idle';
    }
    drawMachine();
  }

  function payOut(c) {
    // coins that fall just vanish; jackpot accumulates via prizes
  }

  function next() {
    if (falling) return;
    coins = [];
    initPrizes();
    phase = 'idle';
    setMsg('Drop a coin and knock prizes off the ledge');
    drawMachine();
  }

  document.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => { setBet(Number(btn.dataset.chip)); SoundKit.sfx.chip(); });
  });
  els.drop.addEventListener('click', dropCoin);
  els.newRound.addEventListener('click', next);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ') { e.preventDefault(); dropCoin(); }
  });

  initPrizes();
  renderStats();
  drawMachine();
})();
