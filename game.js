(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    dealerHand: $('dealer-hand'),
    playerHand: $('player-hand'),
    dealerScore: $('dealer-score'),
    playerScore: $('player-score'),
    message: $('message'),
    bet: $('bet'),
    bankroll: $('bankroll'),
    betPanel: $('bet-panel'),
    actionPanel: $('action-panel'),
    endPanel: $('end-panel'),
    deal: $('deal'),
    clear: $('clear-bet'),
    hit: $('hit'),
    stand: $('stand'),
    dbl: $('double'),
    newRound: $('new-round'),
    rebuy: $('rebuy'),
    music: $('music-toggle'),
  };

  const SUITS = [
    { s: '\u2660', c: 'black' },
    { s: '\u2665', c: 'red' },
    { s: '\u2666', c: 'red' },
    { s: '\u2663', c: 'black' },
  ];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const MIN_CHIP = 5;

  let shoe = [];
  let dealer = [];
  let player = [];
  let holeHidden = true;
  let bankroll = loadBankroll() ?? 1000;
  let bet = 0;
  let phase = 'betting'; // betting | dealing | player | dealer | settling | done | broke

  function loadBankroll() {
    try {
      const v = parseInt(localStorage.getItem('grbj-bankroll'), 10);
      return Number.isFinite(v) && v >= 0 ? v : null;
    } catch {
      return null;
    }
  }

  function save() {
    try { localStorage.setItem('grbj-bankroll', String(bankroll)); } catch { /* ignore */ }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => '$' + n.toLocaleString('en-US');

  function buildShoe() {
    shoe = [];
    for (let d = 0; d < 6; d++) {
      for (const su of SUITS) {
        for (const r of RANKS) shoe.push({ rank: r, suit: su.s, color: su.c });
      }
    }
    for (let i = shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
  }

  function draw() {
    if (shoe.length < 60) buildShoe();
    return shoe.pop();
  }

  function value(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
      if (c.rank === 'A') { total += 11; aces++; }
      else if ('KQJ'.includes(c.rank)) total += 10;
      else total += Number(c.rank);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total, soft: aces > 0 };
  }

  const isBlackjack = (cards) => cards.length === 2 && value(cards).total === 21;

  function faceHTML(c) {
    return (
      `<div class="corner tl"><span>${c.rank}</span><span>${c.suit}</span></div>` +
      `<div class="pip">${c.suit}</div>` +
      `<div class="corner br"><span>${c.rank}</span><span>${c.suit}</span></div>`
    );
  }

  function addCard(target, card, faceDown = false) {
    const el = document.createElement('div');
    el.className = `card ${card.color}${faceDown ? ' face-down' : ''} dealt`;
    el.innerHTML = faceDown ? '' : faceHTML(card);
    target.appendChild(el);
    SoundKit.sfx.card();
    return el;
  }

  function clearTable() {
    els.dealerHand.innerHTML = '';
    els.playerHand.innerHTML = '';
  }

  function scoreText(cards) {
    const v = value(cards);
    return v.soft && v.total !== 21 ? `soft ${v.total}` : String(v.total);
  }

  function updateScores() {
    els.playerScore.textContent = player.length ? scoreText(player) : '';
    if (!dealer.length) {
      els.dealerScore.textContent = '';
    } else if (holeHidden) {
      els.dealerScore.textContent = `${value(dealer.slice(0, 1)).total} + ?`;
    } else {
      els.dealerScore.textContent = scoreText(dealer);
    }
  }

  function renderStats() {
    els.bankroll.textContent = fmt(bankroll);
    els.bet.textContent = fmt(bet);
  }

  function setMsg(text, cls = '') {
    els.message.textContent = text;
    els.message.className = `message${cls ? ' ' + cls : ''}`;
  }

  async function revealHole() {
    if (!holeHidden || dealer.length < 2) return;
    holeHidden = false;
    const el = els.dealerHand.children[1];
    el.innerHTML = faceHTML(dealer[1]);
    el.classList.remove('face-down');
    el.classList.add('flip');
    SoundKit.sfx.card();
    updateScores();
    await sleep(350);
  }

  function refreshControls() {
    els.betPanel.hidden = phase !== 'betting';
    els.actionPanel.hidden = phase !== 'player';
    els.endPanel.hidden = !(phase === 'done' || phase === 'broke');
    els.newRound.hidden = phase === 'broke';
    els.rebuy.hidden = phase !== 'broke';
    document.querySelectorAll('.chip-btn').forEach((b) => {
      b.disabled = phase !== 'betting' || bet + Number(b.dataset.chip) > bankroll;
    });
    els.clear.disabled = phase !== 'betting' || bet === 0;
    els.deal.disabled = phase !== 'betting' || bet === 0 || bet > bankroll;
    els.hit.disabled = false;
    els.stand.disabled = false;
    els.dbl.disabled = !(player.length === 2 && bankroll >= bet);
  }

  function setBet(v) {
    bet = Math.max(0, Math.min(v, bankroll));
    renderStats();
    refreshControls();
  }

  async function deal() {
    if (phase !== 'betting' || bet <= 0 || bet > bankroll) return;
    SoundKit.sfx.chip();
    bankroll -= bet;
    save();
    phase = 'dealing';
    clearTable();
    player = [];
    dealer = [];
    holeHidden = true;
    updateScores();
    renderStats();
    refreshControls();

    player.push(draw());
    addCard(els.playerHand, player[0]);
    await sleep(320);

    dealer.push(draw());
    addCard(els.dealerHand, dealer[0]);
    await sleep(320);

    player.push(draw());
    addCard(els.playerHand, player[1]);
    await sleep(320);

    dealer.push(draw());
    addCard(els.dealerHand, dealer[1], true);
    updateScores();

    if (isBlackjack(player) || isBlackjack(dealer)) {
      phase = 'settling';
      refreshControls();
      await sleep(500);
      await revealHole();
      await sleep(300);
      finishRound();
      return;
    }

    phase = 'player';
    refreshControls();
  }

  async function hit() {
    if (phase !== 'player') return;
    player.push(draw());
    addCard(els.playerHand, player[player.length - 1]);
    updateScores();
    const v = value(player);
    if (v.total > 21) {
      phase = 'settling';
      refreshControls();
      setMsg(`Bust with ${v.total}.`, 'lose');
      await sleep(700);
      await revealHole();
      finishRound();
    } else if (v.total === 21) {
      stand();
    } else {
      refreshControls();
    }
  }

  function stand() {
    if (phase !== 'player') return;
    phase = 'dealer';
    refreshControls();
    dealerPlay();
  }

  async function dealerPlay() {
    await revealHole();
    updateScores();
    while (value(dealer).total < 17) {
      await sleep(600);
      dealer.push(draw());
      addCard(els.dealerHand, dealer[dealer.length - 1]);
      updateScores();
    }
    await sleep(450);
    finishRound();
  }

  async function doubleDown() {
    if (!(phase === 'player' && player.length === 2 && bankroll >= bet)) return;
    SoundKit.sfx.chip();
    bankroll -= bet;
    save();
    bet *= 2;
    phase = 'settling';
    renderStats();
    refreshControls();
    await sleep(250);
    player.push(draw());
    addCard(els.playerHand, player[player.length - 1]);
    updateScores();
    await sleep(650);
    const v = value(player);
    if (v.total > 21) {
      setMsg(`Bust with ${v.total}.`, 'lose');
      await sleep(500);
      await revealHole();
      finishRound();
    } else {
      phase = 'dealer';
      refreshControls();
      dealerPlay();
    }
  }

  function outcome() {
    const pTotal = value(player).total;
    const dTotal = value(dealer).total;
    const pBJ = isBlackjack(player);
    const dBJ = isBlackjack(dealer);

    if (pBJ && dBJ) return { k: 'push', amt: bet, msg: 'Both blackjack \u2014 push.' };
    if (pBJ) return { k: 'win', amt: bet + Math.floor(bet * 1.5), msg: `Blackjack! You win ${fmt(Math.floor(bet * 1.5))}.` };
    if (dBJ) return { k: 'lose', amt: 0, msg: 'Dealer has blackjack.' };
    if (pTotal > 21) return { k: 'lose', amt: 0, msg: `Bust with ${pTotal}. Dealer wins.` };
    if (dTotal > 21) return { k: 'win', amt: bet * 2, msg: `Dealer busts with ${dTotal} \u2014 you win ${fmt(bet)}!` };
    if (pTotal > dTotal) return { k: 'win', amt: bet * 2, msg: `${pTotal} beats ${dTotal} \u2014 you win ${fmt(bet)}!` };
    if (pTotal < dTotal) return { k: 'lose', amt: 0, msg: `Dealer's ${dTotal} beats your ${pTotal}.` };
    return { k: 'push', amt: bet, msg: `${pTotal} vs ${dTotal} \u2014 push.` };
  }

  function finishRound() {
    const o = outcome();
    bankroll += o.amt;
    save();
    renderStats();
    setMsg(o.msg, o.k === 'win' ? 'win' : o.k === 'lose' ? 'lose' : 'push');
    SoundKit.sfx[o.k === 'win' ? 'win' : o.k === 'lose' ? 'lose' : 'push']();
    phase = bankroll < MIN_CHIP ? 'broke' : 'done';
    refreshControls();
  }

  function newRound() {
    if (bankroll < MIN_CHIP) {
      phase = 'broke';
      refreshControls();
      return;
    }
    clearTable();
    player = [];
    dealer = [];
    holeHidden = true;
    updateScores();
    phase = 'betting';
    setBet(Math.min(Math.max(bet, MIN_CHIP), bankroll));
    setMsg('Place your bet');
    refreshControls();
  }

  function rebuy() {
    bankroll = 1000;
    bet = 0;
    save();
    renderStats();
    newRound();
    SoundKit.sfx.chip();
  }

  // ---------- Events ----------

  document.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (phase !== 'betting') return;
      setBet(bet + Number(btn.dataset.chip));
      SoundKit.sfx.chip();
    });
  });

  els.clear.addEventListener('click', () => setBet(0));
  els.deal.addEventListener('click', deal);
  els.hit.addEventListener('click', hit);
  els.stand.addEventListener('click', stand);
  els.dbl.addEventListener('click', doubleDown);
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
    if (k === 'h') hit();
    else if (k === 's') stand();
    else if (k === 'd') doubleDown();
    else if (k === 'enter') {
      if (phase === 'betting') deal();
      else if (phase === 'done') newRound();
      else if (phase === 'broke') rebuy();
    }
  });

  // ---------- Init ----------

  buildShoe();
  renderStats();
  setBet(0);
  setMsg('Place your bet to begin');
})();
