(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    spin: $('spin'),
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

  const SYMBOLS = ['7', '🍒', '💎', '🔔', 'BAR'];
  const REEL = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4];

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let spinning = false;
  let reels = [0, 0, 0];
  let reelOffsets = [0, 0, 0]; // visual scroll offset in px
  let finalReels = [0, 0, 0];

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

  function renderSymbol(sym, x, y, size) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (sym === 0) {
      ctx.font = '800 ' + size + 'px Inter, sans-serif';
      ctx.fillStyle = '#ff3b5c';
      ctx.shadowColor = '#ff3b5c';
      ctx.shadowBlur = 10;
      ctx.fillText('7', x, y);
      ctx.shadowBlur = 0;
    } else {
      ctx.font = size + 'px sans-serif';
      ctx.fillText(SYMBOLS[sym], x, y);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#24103f');
    grad.addColorStop(1, '#0a0314');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const reelW = W / 3;
    const reelH = 220;
    const startY = 60;
    const cx = [reelW / 2, reelW * 1.5, reelW * 2.5];

    // screen
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, startY - 8, W - 16, reelH + 16);

    for (let r = 0; r < 3; r++) {
      // draw 5 visible symbols of the (scrolling) reel
      const cell = reelH / 3;
      for (let k = -1; k <= 3; k++) {
        const idx = ((reels[r] + k) % REEL.length + REEL.length) % REEL.length;
        const y = startY + k * cell + (spinning ? reelOffsets[r] : 0);
        renderSymbol(REEL[idx], cx[r], y + cell / 2, 42);
      }
      // reel separators
      ctx.strokeStyle = 'rgba(255,225,77,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx[r] + reelW / 2 - 4, startY - 10);
      ctx.lineTo(cx[r] + reelW / 2 - 4, startY + reelH + 10);
      ctx.stroke();
    }

    // win line
    ctx.strokeStyle = 'rgba(255,225,77,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    const midY = startY + reelH / 2;
    ctx.beginPath();
    ctx.moveTo(14, midY);
    ctx.lineTo(W - 14, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // handle
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(W - 26, startY + reelH + 20, 10, 40);
    ctx.beginPath();
    ctx.arc(W - 21, startY + reelH + 64, 12, 0, Math.PI * 2);
    ctx.shadowColor = '#ffe14d';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function payout(a, b, c) {
    if (a === 0 && b === 0 && c === 0) return 100;
    if (a === 1 && b === 1 && c === 1) return 20;
    if (a === 2 && b === 2 && c === 2) return 10;
    if (a === b && b === c) return 5;
    if (a === b || b === c || a === c) return 2;
    if (a === 3 || b === 3 || c === 3) return 1;
    return 0;
  }

  async function spin() {
    if (spinning) return;
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    spinning = true;

    finalReels = [rand(5), rand(5), rand(5)];
    const t0 = performance.now();
    const dur = 1600;

    // reel scroll animation
    while (performance.now() - t0 < dur) {
      const p = (performance.now() - t0) / dur;
      for (let r = 0; r < 3; r++) {
        const done = p > (r + 1) * 0.28;
        if (!done || Math.random() < 0.03) reels[r] = (reels[r] + 1) % REEL.length;
      }
      reelOffsets = [0, 4, 8];
      draw();
      await sleep(30);
    }
    // snap to final
    const finalIdx = finalReels;
    const current = reels.map((v) => REEL[v]);
    const target = finalIdx;
    reels = [0, 0, 0];
    // find each reel index equal to final symbol
    const idx = target.map((sym) => REEL.indexOf(sym));
    reels = idx;
    reelOffsets = [0, 0, 0];
    draw();
    SoundKit.sfx.card();

    const mult = payout(...finalReels);
    const won = bet * mult;
    bankroll += won;
    save();
    renderStats();

    if (mult >= 20) {
      setMsg(`JACKPOT! Triple match ${SYMBOLS[finalReels[0]]}${SYMBOLS[finalReels[1]]}${SYMBOLS[finalReels[2]]} — ${fmt(won)}!`, 'win');
      SoundKit.sfx.win();
    } else if (mult >= 5) {
      setMsg(`Three ${SYMBOLS[finalReels[0]]} — you win ${fmt(won)}!`, 'win');
      SoundKit.sfx.win();
    } else if (mult === 2) {
      setMsg(`Two match — you win ${fmt(won)}!`, 'push');
      SoundKit.sfx.push();
    } else if (mult === 1) {
      setMsg(`A bell pays ${fmt(won)}.`, 'push');
      SoundKit.sfx.push();
    } else {
      setMsg('No matching line. Try again.', 'lose');
      SoundKit.sfx.lose();
    }
    spinning = false;
    if (bankroll < MIN_CHIP) setMsg('Low on credits — rebuy at a table.', 'lose');
  }

  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.addEventListener('click', () => { setBet(Number(b.dataset.chip)); SoundKit.sfx.chip(); });
  });
  els.spin.addEventListener('click', spin);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); spin(); }
  });

  renderStats();
  draw();
})();