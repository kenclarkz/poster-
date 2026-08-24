(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    board: $('board'),
    spin: $('spin'),
    clear: $('clear-bet'),
    undo: $('undo'),
    endPanel: $('end-panel'),
    newRound: $('new-round'),
    rebuy: $('rebuy'),
    music: $('music-toggle'),
    canvas: $('wheel'),
    resultBadge: $('result-badge'),
    resultNum: $('result-num'),
    resultColor: $('result-color'),
    history: $('history'),
  };

  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const STEP = (Math.PI * 2) / ORDER.length;
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const TAU = Math.PI * 2;
  const MIN_CHIP = 5;
  const BANK_KEY = 'grbj-bankroll';
  const IDLE_SPEED = 0.22;
  const SPIN_SPEED = 0.55;
  const TRACK_R = 0.885;
  const SETTLE_R = 0.70;

  const colorOf = (n) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');
  const colorCss = { red: '#ff3b5c', black: '#aebfd8', green: '#39ff88' };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => '$' + n.toLocaleString('en-US');

  let bankroll = loadBankroll() ?? 1000;
  let bets = new Map();
  let betStack = [];
  let currentChip = 25;
  let phase = 'betting';
  let history = [];
  let lastWin = null;

  function loadBankroll() {
    try {
      const v = parseInt(localStorage.getItem(BANK_KEY), 10);
      return Number.isFinite(v) && v >= 0 ? v : null;
    } catch {
      return null;
    }
  }

  function save() {
    try { localStorage.setItem(BANK_KEY, String(bankroll)); } catch { /* ignore */ }
  }

  function totalBet() {
    let t = 0;
    bets.forEach((v) => { t += v; });
    return t;
  }

  function setMsg(text, cls = '') {
    els.message.textContent = text;
    els.message.className = `message${cls ? ' ' + cls : ''}`;
  }

  function renderStats() {
    els.bankroll.textContent = fmt(bankroll);
    els.bet.textContent = fmt(totalBet());
  }

  // ---------- Board ----------

  const spotEls = new Map();
  const amtEls = new Map();

  function makeCell(spot, label, colorCls = '', extra = '') {
    const d = document.createElement('div');
    d.className = `cell ${extra}${colorCls ? ' ' + colorCls : ''}`;
    d.dataset.spot = spot;
    d.innerHTML = `<span class="lbl">${label}</span><span class="amt" hidden></span>`;
    d.addEventListener('click', () => placeChip(spot));
    spotEls.set(spot, d);
    amtEls.set(spot, d.querySelector('.amt'));
    return d;
  }

  function buildBoard() {
    const frag = document.createDocumentFragment();

    const zero = makeCell('n0', '0', 'green', 'zero');
    zero.style.gridColumn = '1';
    zero.style.gridRow = '1 / span 3';
    frag.appendChild(zero);

    for (let col = 1; col <= 12; col++) {
      for (let row = 0; row < 3; row++) {
        const n = col * 3 - row;
        const c = makeCell('n' + n, String(n), colorOf(n));
        c.style.gridColumn = String(col + 1);
        c.style.gridRow = String(row + 1);
        frag.appendChild(c);
      }
    }

    [['col3', '2:1'], ['col2', '2:1'], ['col1', '2:1']].forEach(([k, label], i) => {
      const c = makeCell(k, label, '', 'outside');
      c.style.gridColumn = '14';
      c.style.gridRow = String(i + 1);
      frag.appendChild(c);
    });

    [['dz1', '1st 12', 2], ['dz2', '2nd 12', 6], ['dz3', '3rd 12', 10]].forEach(([k, label, col]) => {
      const c = makeCell(k, label, '', 'outside');
      c.style.gridColumn = `${col} / span 4`;
      c.style.gridRow = '4';
      frag.appendChild(c);
    });

    [
      ['low', '1&ndash;18', 2], ['even', 'Even', 4],
      ['red', 'Red', 6, 'red'], ['black', 'Black', 8, 'black'],
      ['odd', 'Odd', 10], ['high', '19&ndash;36', 12],
    ].forEach(([k, label, col, cls]) => {
      const c = makeCell(k, label, cls || '', 'outside');
      c.style.gridColumn = `${col} / span 2`;
      c.style.gridRow = '5';
      frag.appendChild(c);
    });

    els.board.replaceChildren(frag);
  }

  function renderBets() {
    spotEls.forEach((_, spot) => {
      const amt = bets.get(spot) || 0;
      const el = amtEls.get(spot);
      el.textContent = amt;
      el.hidden = amt === 0;
    });
    renderStats();
  }

  // ---------- Betting ----------

  function placeChip(spot) {
    if (phase !== 'betting') return;
    if (totalBet() + currentChip > bankroll) {
      setMsg('Not enough in the bankroll for that chip.', 'lose');
      return;
    }
    bets.set(spot, (bets.get(spot) || 0) + currentChip);
    betStack.push({ spot, amt: currentChip });
    SoundKit.sfx.chip();
    renderBets();
    refreshControls();
  }

  function undo() {
    if (phase !== 'betting' || !betStack.length) return;
    const last = betStack.pop();
    const left = (bets.get(last.spot) || 0) - last.amt;
    if (left > 0) bets.set(last.spot, left); else bets.delete(last.spot);
    SoundKit.sfx.card();
    renderBets();
    refreshControls();
  }

  function clearBets() {
    if (phase !== 'betting' || !bets.size) return;
    bets.clear();
    betStack.length = 0;
    SoundKit.sfx.card();
    renderBets();
    refreshControls();
  }

  function refreshControls() {
    document.querySelectorAll('.chip-btn').forEach((b) => {
      b.disabled = phase !== 'betting' || totalBet() + Number(b.dataset.chip) > bankroll;
      b.classList.toggle('selected', Number(b.dataset.chip) === currentChip);
    });
    els.undo.disabled = phase !== 'betting' || !betStack.length;
    els.clear.disabled = phase !== 'betting' || !bets.size;
    els.spin.disabled = phase !== 'betting' || totalBet() === 0 || totalBet() > bankroll;
    els.endPanel.hidden = !(phase === 'done' || phase === 'broke');
    els.newRound.hidden = phase === 'broke';
    els.rebuy.hidden = phase !== 'broke';
    document.body.classList.toggle('locked', phase !== 'betting');
  }

  // ---------- Wheel ----------

  const cv = els.canvas;
  const ctx = cv.getContext('2d');
  const SIZE = 440;
  const CX = SIZE / 2;
  const R = SIZE / 2 - 16;
  const HUB_R = R * 0.42;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = SIZE * dpr;
  cv.height = SIZE * dpr;

  let rot = Math.random() * TAU;
  let ballRest = null;
  let anim = null;
  let lastTs = performance.now();
  const trail = [];

  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  function pt(r, a) {
    return [CX + r * Math.sin(a), CX - r * Math.cos(a)];
  }

  function draw(rotNow, ball, hubText, hubColor) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(25, 240, 255, 0.75)';
    ctx.shadowColor = '#19f0ff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(CX, CX, R + 6, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 46, 196, 0.55)';
    ctx.shadowColor = '#ff2ec4';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(CX, CX, R + 13, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (let i = 0; i < ORDER.length; i++) {
      const n = ORDER[i];
      const a0 = rotNow + i * STEP - STEP / 2;
      const a1 = a0 + STEP;
      const strokeC = colorCss[colorOf(n)];
      ctx.beginPath();
      ctx.moveTo(CX, CX);
      ctx.arc(CX, CX, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle =
        colorOf(n) === 'red'
          ? 'rgba(255, 59, 92, 0.30)'
          : colorOf(n) === 'green'
            ? 'rgba(57, 255, 136, 0.26)'
            : 'rgba(9, 14, 26, 0.88)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = strokeC;
      ctx.shadowColor = strokeC;
      ctx.shadowBlur = 7;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px Inter, system-ui, sans-serif';
    for (let i = 0; i < ORDER.length; i++) {
      ctx.save();
      ctx.translate(CX, CX);
      ctx.rotate(rotNow + i * STEP);
      ctx.translate(0, -R * 0.82);
      ctx.fillStyle = '#eaf6ff';
      ctx.shadowColor = '#9fdcff';
      ctx.shadowBlur = 5;
      ctx.fillText(String(ORDER[i]), 0, 0);
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    const grad = ctx.createRadialGradient(CX, CX, HUB_R * 0.15, CX, CX, HUB_R);
    grad.addColorStop(0, '#0a1424');
    grad.addColorStop(1, '#04070f');
    ctx.beginPath();
    ctx.arc(CX, CX, HUB_R, 0, TAU);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(25, 240, 255, 0.8)';
    ctx.shadowColor = '#19f0ff';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(CX, CX, HUB_R * 0.78, 0, TAU);
    ctx.setLineDash([3, 6]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 46, 196, 0.5)';
    ctx.stroke();
    ctx.setLineDash([]);

    if (hubText) {
      ctx.font = '800 46px Orbitron, Inter, sans-serif';
      ctx.fillStyle = hubColor;
      ctx.shadowColor = hubColor;
      ctx.shadowBlur = 22;
      ctx.fillText(hubText, CX, CX + 2);
      ctx.shadowBlur = 0;
    }

    if (ball) {
      trail.forEach((t, i) => {
        const [tx, ty] = pt(t.r * R, t.abs);
        ctx.beginPath();
        ctx.arc(tx, ty, 5.5 - i * 0.6, 0, TAU);
        ctx.fillStyle = `rgba(220, 245, 255, ${0.22 * (1 - i / trail.length)})`;
        ctx.fill();
      });
      const [bx, by] = pt(ball.r * R, ball.abs);
      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, TAU);
      ctx.fillStyle = '#f4fbff';
      ctx.shadowColor = '#cfeaff';
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastTs = ts; return; }
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    let ball = null;
    let hubText = '';
    let hubColor = '#9ff4ff';

    if (anim) {
      rot = anim.startRot + (SPIN_SPEED * anim.elapsed(ts)) / 1000;
      const p = anim.progress(ts);
      const abs = anim.betaStart + anim.delta * easeOutCubic(p);
      const r = TRACK_R + (SETTLE_R - TRACK_R) * smooth((p - 0.45) / 0.55);
      ball = { abs, r };
      trail.unshift({ abs, r });
      if (trail.length > 6) trail.length = 6;
      const rel = ((abs - rot) % TAU + TAU) % TAU;
      const idx = Math.floor(rel / STEP);
      hubText = String(ORDER[idx]);
      hubColor = colorCss[colorOf(ORDER[idx])];
      if (idx !== anim.lastSector && p < 0.94 && ts - anim.lastTick > 80 && !reduced) {
        anim.lastSector = idx;
        anim.lastTick = ts;
        SoundKit.sfx.card();
      }
      if (p >= 1) {
        ballRest = { idx: anim.target };
        anim.resolve();
        anim = null;
      }
    } else {
      rot += IDLE_SPEED * dt;
      trail.length = 0;
      if (ballRest) {
        ball = { abs: rot + ballRest.idx * STEP, r: SETTLE_R };
        hubText = String(ORDER[ballRest.idx]);
        hubColor = colorCss[colorOf(ORDER[ballRest.idx])];
      } else if (lastWin != null) {
        hubText = String(lastWin);
        hubColor = colorCss[colorOf(lastWin)];
      }
    }

    draw(rot, ball, hubText, hubColor);
  }

  function animateSpin(targetIdx) {
    return new Promise((resolve) => {
      const dur = reduced ? 650 : 5200 + Math.random() * 800;
      const betaStart = ballRest ? rot + ballRest.idx * STEP : rot;
      const betaEndRaw = rot + (SPIN_SPEED * dur) / 1000 + targetIdx * STEP;
      const delta = ((betaEndRaw - betaStart) % TAU) - TAU * 7;
      anim = {
        startRot: rot,
        t0: performance.now(),
        dur,
        betaStart,
        delta,
        target: targetIdx,
        lastSector: -1,
        lastTick: 0,
        resolve,
        elapsed: (ts) => (ts - anim.t0),
        progress: (ts) => Math.min((ts - anim.t0) / dur, 1),
      };
      trail.length = 0;
    });
  }

  // ---------- Payouts ----------

  function payoutFor(spot, n) {
    if (spot[0] === 'n') return Number(spot.slice(1)) === n ? 35 : 0;
    switch (spot) {
      case 'red': return REDS.has(n) ? 1 : 0;
      case 'black': return n !== 0 && !REDS.has(n) ? 1 : 0;
      case 'even': return n !== 0 && n % 2 === 0 ? 1 : 0;
      case 'odd': return n % 2 === 1 ? 1 : 0;
      case 'low': return n >= 1 && n <= 18 ? 1 : 0;
      case 'high': return n >= 19 ? 1 : 0;
      case 'dz1': return n >= 1 && n <= 12 ? 2 : 0;
      case 'dz2': return n >= 13 && n <= 24 ? 2 : 0;
      case 'dz3': return n >= 25 ? 2 : 0;
      case 'col1': return n !== 0 && n % 3 === 1 ? 2 : 0;
      case 'col2': return n !== 0 && n % 3 === 2 ? 2 : 0;
      case 'col3': return n !== 0 && n % 3 === 0 ? 2 : 0;
      default: return 0;
    }
  }

  function settle(n) {
    let ret = 0;
    bets.forEach((amt, spot) => {
      const p = payoutFor(spot, n);
      if (p) ret += amt * (p + 1);
    });
    return ret;
  }

  // ---------- Round flow ----------

  async function spin() {
    if (phase !== 'betting') return;
    const staked = totalBet();
    if (!staked || staked > bankroll) return;

    phase = 'spinning';
    refreshControls();
    SoundKit.sfx.chip();
    bankroll -= staked;
    save();
    renderStats();

    const winning = Math.floor(Math.random() * ORDER.length);
    await animateSpin(winning);
    await sleep(reduced ? 100 : 350);

    const num = ORDER[winning];
    lastWin = num;
    history.unshift(num);
    if (history.length > 12) history.length = 12;
    renderHistory();
    showBadge(num);

    const hitEl = spotEls.get('n' + num);
    if (hitEl) {
      hitEl.classList.remove('hit');
      void hitEl.offsetWidth;
      hitEl.classList.add('hit');
    }

    const returned = settle(num);
    bankroll += returned;
    save();
    bets.clear();
    betStack.length = 0;
    renderBets();

    const net = returned - staked;
    const label = `${num} ${colorOf(num).toUpperCase()}`;
    if (net > 0) {
      setMsg(`${label} — you win ${fmt(net)}!`, 'win');
      SoundKit.sfx.win();
    } else if (net < 0) {
      setMsg(`${label} — house takes it.`, 'lose');
      SoundKit.sfx.lose();
    } else {
      setMsg(`${label} — dead even.`, 'push');
      SoundKit.sfx.push();
    }

    phase = bankroll < MIN_CHIP ? 'broke' : 'done';
    refreshControls();
  }

  function showBadge(num) {
    els.resultNum.textContent = num;
    els.resultColor.textContent = colorOf(num);
    els.resultBadge.classList.remove('red', 'black', 'green', 'pop');
    void els.resultBadge.offsetWidth;
    els.resultBadge.classList.add(colorOf(num), 'pop');
  }

  function renderHistory() {
    const frag = document.createDocumentFragment();
    history.forEach((n) => {
      const d = document.createElement('span');
      d.className = `h ${colorOf(n)}`;
      d.textContent = n;
      frag.appendChild(d);
    });
    els.history.replaceChildren(frag);
  }

  function newRound() {
    if (bankroll < MIN_CHIP) {
      phase = 'broke';
      refreshControls();
      return;
    }
    spotEls.forEach((el) => el.classList.remove('hit'));
    bets.clear();
    betStack.length = 0;
    renderBets();
    phase = 'betting';
    setMsg('Select a chip, tap the felt, hit Spin');
    refreshControls();
  }

  function rebuy() {
    bankroll = 1000;
    save();
    newRound();
    SoundKit.sfx.chip();
  }

  // ---------- Events ----------

  document.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentChip = Number(btn.dataset.chip);
      refreshControls();
    });
  });

  els.spin.addEventListener('click', spin);
  els.clear.addEventListener('click', clearBets);
  els.undo.addEventListener('click', undo);
  els.newRound.addEventListener('click', newRound);
  els.rebuy.addEventListener('click', rebuy);

  els.music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    els.music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    els.music.classList.toggle('on', on);
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'enter') {
      if (phase === 'betting' && totalBet() > 0) {
        e.preventDefault();
        spin();
      } else if (phase === 'done') {
        e.preventDefault();
        newRound();
      } else if (phase === 'broke') {
        e.preventDefault();
        rebuy();
      }
    } else if (k === 'c') clearBets();
    else if (k === 'z') undo();
  });

  // ---------- Init ----------

  buildBoard();
  renderBets();
  refreshControls();
  requestAnimationFrame(frame);
})();
