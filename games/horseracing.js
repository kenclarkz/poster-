(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    pickPanel: $('pick-panel'),
    racePanel: $('race-panel'),
    go: $('go'),
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

  const HORSES = [
    { name: 'Red', color: '#ff3b5c', base: 3.1, max: 5.0, odds: 2.5, label: '5:2' },
    { name: 'Blue', color: '#39d0ff', base: 2.6, max: 4.2, odds: 2.0, label: '2:1' },
    { name: 'Green', color: '#39ff88', base: 2.3, max: 3.6, odds: 0.8, label: '4:5' },
    { name: 'Gold', color: '#ffe14d', base: 2.0, max: 6.0, odds: 7.0, label: '7:1' },
  ];
  const FINISH_X = W - 46;
  const START_X = 60;
  const LANE_H = H / 5;

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let pick = -1;
  let horses = [];
  let racing = false;

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

  function resetHorses() {
    horses = HORSES.map((h, i) => ({ ...h, x: START_X, step: 0 }));
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0c1a12');
    grad.addColorStop(1, '#05090f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // lanes and finish line
    for (let i = 0; i < 4; i++) {
      const y = 30 + i * LANE_H;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(0, y + LANE_H);
      ctx.lineTo(W, y + LANE_H);
      ctx.stroke();
      // start gate line
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(START_X, y);
      ctx.lineTo(START_X, y + LANE_H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // finish line checkered
    ctx.fillStyle = '#fff';
    for (let row = 0; row < 18; row++) {
      for (let col = 0; col < 6; col++) {
        const x = FINISH_X + 8 - col * 4;
        const y = row * 12;
        if ((row + col) % 2 === 0) ctx.fillRect(x, y, 4, 12);
      }
    }

    horses.forEach((h, i) => {
      const y = 30 + i * LANE_H + LANE_H / 2 - 14;
      // horse body
      ctx.fillStyle = h.color;
      ctx.shadowColor = h.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(h.x, y + 6, 30, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // head
      ctx.beginPath();
      ctx.arc(h.x + 26, y, 10, 0, Math.PI * 2);
      ctx.fill();
      // name tag
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(h.name, h.x - 42, y + 9);
      // odds
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'left';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText(h.label + ' odds', h.x + 46, y + 10);
    });
  }

  async function race() {
    if (racing || pick < 0) { if (pick < 0) setMsg('Pick a horse first.', 'lose'); return; }
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    racing = true;
    els.go.disabled = true;
    setMsg('They\'re off!');

    resetHorses();
    // winner chosen by weighted odds
    const weights = HORSES.map((h) => 1 / h.odds);
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let winner = 0;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { winner = i; break; } }

    // race loop with finishing order
    const finishOrder = [];
    while (finishOrder.length < 4) {
      await sleep(50);
      for (let i = 0; i < horses.length; i++) {
        const h = horses[i];
        if (h.x >= FINISH_X) continue;
        const base = HORSES[i].base;
        // winner surges if it's the chosen winner
        let spd = base * (0.5 + Math.random());
        if (i === winner && !winnerSurged) spd *= 1.4;
        h.x = Math.min(FINISH_X, h.x + spd);
        if (h.x >= FINISH_X) {
          finishOrder.push(i);
          SoundKit.sfx.card();
          if (i === winner) winnerSurged = true;
        }
      }
      draw();
    }

    const winnerIndex = finishOrder[0];
    const won = Math.round(bet * HORSES[winnerIndex].odds + bet);
    const pickWon = winnerIndex === pick;

    bankroll += won;
    save();
    renderStats();

    if (pickWon) {
      setMsg(`${HORSES[winnerIndex].name} wins — your pick came through for ${fmt(won)}!`, 'win');
      SoundKit.sfx.win();
    } else {
      setMsg(`${HORSES[winnerIndex].name} wins. House keeps your ${fmt(bet)}.`, 'lose');
      SoundKit.sfx.lose();
    }
    racing = false;
    els.go.disabled = false;
    resetHorses();
    if (bankroll < MIN_CHIP) setMsg('Low on credits — rebuy at a table.', 'lose');
  }
  let winnerSurged = false;

  function pickHorse(i) {
    if (racing) return;
    pick = i;
    setMsg(`You back ${HORSES[i].name}. Ready to race.`, 'push');
    document.querySelectorAll('.horse-pick').forEach((b, idx) => {
      b.style.borderColor = idx === i ? '#ffe14d' : '';
      b.style.color = idx === i ? '#ffe14d' : '';
    });
  }

  document.querySelectorAll('.horse-pick').forEach((b) => {
    b.addEventListener('click', () => pickHorse(Number(b.dataset.horse)));
  });
  els.go.addEventListener('click', race);

  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.addEventListener('click', () => { setBet(Number(b.dataset.chip)); SoundKit.sfx.chip(); });
  });

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); race(); }
  });

  renderStats();
  resetHorses();
})();