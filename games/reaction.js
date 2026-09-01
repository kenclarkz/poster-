(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    time: $('time'),
    start: $('start'),
    music: $('music-toggle'),
    canvas: $('game'),
  };

  const { fmt, loadBankroll, save, sleep, randBetween, MIN_CHIP, DEFAULT_BANKROLL } = Arcade;

  const CV = els.canvas;
  const ctx = CV.getContext('2d');
  const W = CV.width;
  const H = CV.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  CV.width = W * dpr;
  CV.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let bankroll = loadBankroll() ?? DEFAULT_BANKROLL;
  let bet = 10;
  let state = 'idle';  // idle | waiting | armed | too_early | done
  let goTime = 0;
  let reaction = null;

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

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const rectW = W - 80;
    const rectH = H - 80;
    const x = 40, y = 40;

    if (state === 'idle' || state === 'waiting') {
      ctx.fillStyle = '#3a2c5a';
    } else if (state === 'armed') {
      ctx.fillStyle = '#39ff88';
      ctx.shadowColor = '#39ff88';
      ctx.shadowBlur = 30;
    } else if (state === 'too_early') {
      ctx.fillStyle = '#ff3b5c';
      ctx.shadowColor = '#ff3b5c';
      ctx.shadowBlur = 30;
    } else {
      ctx.fillStyle = '#2a2050';
    }
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, rectW, rectH, 22) : ctx.rect(x, y, rectW, rectH);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 26px Bungee, Inter, sans-serif';
    let label = 'PRESS START';
    if (state === 'waiting') label = 'WAIT… GET READY';
    else if (state === 'armed') label = 'CLICK NOW!';
    else if (state === 'too_early') label = 'TOO EARLY';
    else if (state === 'done') label = 'CLICK TO PLAY AGAIN';
    ctx.fillText(label, W / 2, H / 2);
  }

  async function start() {
    if (bankroll < bet) { setMsg('Not enough in the bankroll.', 'lose'); return; }
    bankroll -= bet;
    save();
    renderStats();
    SoundKit.sfx.chip();
    reaction = null;
    els.time.textContent = '—';
    setMsg('Get ready…');
    state = 'waiting';
    draw();

    const delay = randBetween(1200, 3200);
    await sleep(delay);

    if (state !== 'waiting') return; // clicked early or reset during wait
    state = 'armed';
    goTime = performance.now();
    SoundKit.sfx.win();
    draw();
  }

  function react() {
    if (state === 'idle' || state === 'done') {
      start();
      return;
    }
    if (state === 'waiting') {
      state = 'too_early';
      setMsg('Too early! You lose the wager.', 'lose');
      SoundKit.sfx.lose();
      draw();
      return;
    }
    if (state === 'armed') {
      reaction = performance.now() - goTime;
      els.time.textContent = Math.round(reaction) + ' ms';
      let mult = 0;
      if (reaction < 200) mult = 5;
      else if (reaction < 300) mult = 3;
      else if (reaction < 450) mult = 2;
      else if (reaction < 700) mult = 1;
      else mult = 0;

      const won = bet * mult;
      bankroll += won;
      save();
      renderStats();

      if (mult >= 5) { setMsg(`Lightning! ${Math.round(reaction)} ms — you win ${fmt(won)}!`, 'win'); SoundKit.sfx.win(); }
      else if (mult >= 3) { setMsg(`Fast! ${Math.round(reaction)} ms — you win ${fmt(won)}!`, 'win'); SoundKit.sfx.win(); }
      else if (mult >= 1) { setMsg(`${Math.round(reaction)} ms — you win ${fmt(won)}.`, 'push'); SoundKit.sfx.push(); }
      else { setMsg(`${Math.round(reaction)} ms — too slow, no payout.`, 'lose'); SoundKit.sfx.lose(); }

      state = 'done';
      draw();
    }
  }

  CV.addEventListener('pointerdown', react);

  document.querySelectorAll('.chip-btn').forEach((b) => {
    b.addEventListener('click', () => { setBet(Number(b.dataset.chip)); SoundKit.sfx.chip(); });
  });
  els.start.addEventListener('click', react);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ') { e.preventDefault(); react(); }
  });

  renderStats();
  draw();
})();