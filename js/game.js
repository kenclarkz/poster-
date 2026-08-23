(() => {
  const SUITS = [
    { glyph: "♠", red: false },
    { glyph: "♥", red: true },
    { glyph: "♦", red: true },
    { glyph: "♣", red: false }
  ];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const DECK_COUNT = 6;
  const SHOE_MIN = 20;
  const MIN_CHIP = 10;
  const START_BANK = 1000;

  const state = {
    phase: "betting",
    shoe: [],
    bet: 0,
    bankroll: START_BANK,
    player: [],
    dealer: [],
    holeEl: null,
    busy: false
  };

  let displayedBankroll = state.bankroll;

  try {
    const saved = parseInt(localStorage.getItem("bj_bankroll"), 10);
    if (Number.isFinite(saved) && saved >= 0) state.bankroll = saved;
    displayedBankroll = state.bankroll;
  } catch {}

  const els = {
    bankrollAmount: document.getElementById("bankrollAmount"),
    musicBtn: document.getElementById("musicBtn"),
    sfxBtn: document.getElementById("sfxBtn"),
    shoeInfo: document.getElementById("shoeInfo"),
    dealerCards: document.getElementById("dealerCards"),
    playerCards: document.getElementById("playerCards"),
    dealerScore: document.getElementById("dealerScore"),
    playerScore: document.getElementById("playerScore"),
    message: document.getElementById("message"),
    betPill: document.getElementById("betPill"),
    betAmount: document.getElementById("betAmount"),
    betPanel: document.getElementById("betPanel"),
    actionPanel: document.getElementById("actionPanel"),
    resultPanel: document.getElementById("resultPanel"),
    clearBtn: document.getElementById("clearBtn"),
    dealBtn: document.getElementById("dealBtn"),
    hitBtn: document.getElementById("hitBtn"),
    standBtn: document.getElementById("standBtn"),
    dblBtn: document.getElementById("dblBtn"),
    nextBtn: document.getElementById("nextBtn")
  };

  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function buildShoe() {
    state.shoe = [];
    for (let d = 0; d < DECK_COUNT; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          let v;
          if (rank === "A") v = 11;
          else if (rank === "J" || rank === "Q" || rank === "K") v = 10;
          else v = parseInt(rank, 10);
          state.shoe.push({ rank, suit, value: v });
        }
      }
    }
    for (let i = state.shoe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.shoe[i], state.shoe[j]] = [state.shoe[j], state.shoe[i]];
    }
    AudioEngine.sfx.shuffle();
    updateShoeInfo();
  }

  function updateShoeInfo() {
    els.shoeInfo.textContent = `Shoe · ${state.shoe.length}`;
  }

  function handValue(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
      total += c.value;
      if (c.rank === "A") aces++;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return { total, soft: aces > 0 };
  }

  function isNatural(hand) {
    return hand.length === 2 && handValue(hand).total === 21;
  }

  function scoreLabel(cards) {
    const { total, soft } = handValue(cards);
    if (total > 21) return `${total} · Bust`;
    return soft ? `${total - 10}/${total}` : `${total}`;
  }

  function createCardEl(card) {
    const cardEl = document.createElement("div");
    cardEl.className = "card";
    const flip = document.createElement("div");
    flip.className = "flip";
    const back = document.createElement("div");
    back.className = "face back";
    const front = document.createElement("div");
    front.className = `face front${card.suit.red ? " red" : ""}`;
    front.innerHTML = `
      <span class="corner tl"><span class="rank">${card.rank}</span><span class="suit">${card.suit.glyph}</span></span>
      <span class="pip">${card.suit.glyph}</span>
      <span class="corner br"><span class="rank">${card.rank}</span><span class="suit">${card.suit.glyph}</span></span>`;
    flip.append(back, front);
    cardEl.append(flip);
    return { cardEl, flip };
  }

  async function dealCard(hand, container, faceUp) {
    const card = state.shoe.pop();
    hand.push(card);
    const { cardEl, flip } = createCardEl(card);
    container.append(cardEl);
    AudioEngine.sfx.card();
    updateShoeInfo();
    await sleep(180);
    if (faceUp) flip.classList.add("show");
    await sleep(200);
    updateScores();
    return { card, cardEl, flip };
  }

  function updateScores() {
    if (state.player.length === 0 || state.dealer.length === 0) {
      els.playerScore.classList.add("hidden");
      els.dealerScore.classList.add("hidden");
      return;
    }
    const pVal = handValue(state.player);
    els.playerScore.textContent = scoreLabel(state.player);
    els.playerScore.classList.toggle("bust", pVal.total > 21);
    els.playerScore.classList.remove("hidden");

    const holeHidden =
      state.phase === "dealing" ||
      (state.phase === "player" && state.dealer.length === 2);

    if (holeHidden) {
      const upVal = handValue([state.dealer[0]]);
      els.dealerScore.textContent = `${upVal.total}`;
      els.dealerScore.classList.remove("bust");
    } else {
      const dVal = handValue(state.dealer);
      els.dealerScore.textContent = scoreLabel(state.dealer);
      els.dealerScore.classList.toggle("bust", dVal.total > 21);
    }
    els.dealerScore.classList.remove("hidden");
  }

  async function revealHole() {
    if (!state.holeEl) return;
    AudioEngine.sfx.flip();
    state.holeEl.classList.add("show");
    state.holeEl = null;
    await sleep(600);
    updateScores();
  }

  function setMessage(text, kind = "") {
    els.message.textContent = text;
    els.message.classList.remove("win", "lose", "push");
    if (kind) els.message.classList.add(kind);
  }

  function tweenBankroll(target) {
    const from = displayedBankroll;
    displayedBankroll = target;
    const start = performance.now();
    const dur = 500;
    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      els.bankrollAmount.textContent = fmt.format(
        Math.round(from + (target - from) * eased)
      );
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    try {
      localStorage.setItem("bj_bankroll", String(state.bankroll));
    } catch {}
  }

  function refreshMoney() {
    tweenBankroll(state.bankroll);
    els.betAmount.textContent = fmt.format(state.bet);
    els.betPill.classList.toggle("hidden", state.bet <= 0 && state.phase !== "player" && state.phase !== "dealer");
    updateChipAvailability();
    updateDoubleAvailability();
  }

  function updateChipAvailability() {
    document.querySelectorAll(".chip").forEach((chipBtn) => {
      const val = parseInt(chipBtn.dataset.value, 10);
      chipBtn.disabled =
        state.phase !== "betting" || state.busy || state.bankroll < val;
    });
    els.clearBtn.disabled = state.phase !== "betting" || state.busy || state.bet === 0;
    els.dealBtn.disabled = state.phase !== "betting" || state.busy || state.bet === 0;
  }

  function updateDoubleAvailability() {
    const canDouble =
      state.phase === "player" &&
      !state.busy &&
      state.player.length === 2 &&
      state.bankroll >= state.bet;
    els.dblBtn.disabled = !canDouble;
    els.hitBtn.disabled = state.phase !== "player" || state.busy;
    els.standBtn.disabled = state.phase !== "player" || state.busy;
  }

  function showPanel(name) {
    els.betPanel.classList.toggle("hidden", name !== "bet");
    els.actionPanel.classList.toggle("hidden", name !== "action");
    els.resultPanel.classList.toggle("hidden", name !== "result");
  }

  function addChip(value) {
    if (state.phase !== "betting" || state.busy) return;
    if (state.bankroll < value) return;
    state.bankroll -= value;
    state.bet += value;
    AudioEngine.sfx.chip();
    els.betPill.classList.add("bump");
    setTimeout(() => els.betPill.classList.remove("bump"), 160);
    setMessage(`Bet ${fmt.format(state.bet)} · Deal when ready`);
    refreshMoney();
  }

  function clearBet() {
    if (state.phase !== "betting" || state.busy) return;
    state.bankroll += state.bet;
    state.bet = 0;
    AudioEngine.sfx.chip();
    setMessage("Place your bet");
    refreshMoney();
  }

  async function deal() {
    if (state.phase !== "betting" || state.busy || state.bet === 0) return;
    state.busy = true;
    updateChipAvailability();
    state.phase = "dealing";
    showPanel(null);
    setMessage("Dealing…");

    if (state.shoe.length < SHOE_MIN) buildShoe();

    state.player = [];
    state.dealer = [];
    state.holeEl = null;
    els.dealerCards.innerHTML = "";
    els.playerCards.innerHTML = "";

    await dealCard(state.player, els.playerCards, true);
    await dealCard(state.dealer, els.dealerCards, true);
    await dealCard(state.player, els.playerCards, true);
    const hole = await dealCard(state.dealer, els.dealerCards, false);
    state.holeEl = hole.flip;

    if (isNatural(state.player) || isNatural(state.dealer)) {
      await sleep(350);
      await dealerRevealAndSettle();
      return;
    }

    state.phase = "player";
    state.busy = false;
    setMessage("Your move");
    showPanel("action");
    updateScores();
    updateDoubleAvailability();
    updateChipAvailability();
  }

  async function hit() {
    if (state.phase !== "player" || state.busy) return;
    state.busy = true;
    updateDoubleAvailability();
    await dealCard(state.player, els.playerCards, true);
    const { total } = handValue(state.player);
    if (total > 21) {
      setMessage("Bust!", "lose");
      await sleep(650);
      await dealerRevealAndSettle();
      return;
    }
    if (total === 21) {
      state.busy = false;
      await stand();
      return;
    }
    state.busy = false;
    updateScores();
    updateDoubleAvailability();
  }

  async function stand() {
    if (state.phase !== "player" || state.busy) return;
    state.busy = true;
    updateDoubleAvailability();
    await dealerPlay();
  }

  async function doubleDown() {
    if (
      state.phase !== "player" ||
      state.busy ||
      state.player.length !== 2 ||
      state.bankroll < state.bet
    )
      return;
    state.busy = true;
    state.bankroll -= state.bet;
    state.bet *= 2;
    AudioEngine.sfx.chip();
    refreshMoney();
    setMessage("Double down");
    await sleep(400);
    await dealCard(state.player, els.playerCards, true);
    const { total } = handValue(state.player);
    if (total > 21) {
      setMessage("Bust!", "lose");
      await sleep(650);
      await dealerRevealAndSettle();
      return;
    }
    await dealerPlay();
  }

  async function dealerPlay() {
    state.phase = "dealer";
    showPanel(null);
    setMessage("Dealer plays…");
    updateChipAvailability();
    await dealerRevealAndSettle(true);
  }

  async function dealerRevealAndSettle(dealerDraws = false) {
    state.phase = "dealerTurn";
    await revealHole();

    if (dealerDraws) {
      let dVal = handValue(state.dealer);
      while (dVal.total < 17) {
        await sleep(520);
        await dealCard(state.dealer, els.dealerCards, true);
        dVal = handValue(state.dealer);
      }
      await sleep(420);
    }

    settle();
  }

  function settle() {
    const p = handValue(state.player).total;
    const d = handValue(state.dealer).total;
    const pBJ = isNatural(state.player);
    const dBJ = isNatural(state.dealer);
    const stake = state.bet;

    let payout = 0;
    let text = "";
    let kind = "";

    if (pBJ && !dBJ) {
      payout = stake + Math.floor(stake * 1.5);
      text = `Blackjack! · +${fmt.format(Math.floor(stake * 1.5))}`;
      kind = "win";
      AudioEngine.sfx.blackjack();
    } else if (dBJ && !pBJ) {
      text = `Dealer blackjack · −${fmt.format(stake)}`;
      kind = "lose";
      AudioEngine.sfx.lose();
    } else if (p > 21) {
      text = `Bust · −${fmt.format(stake)}`;
      kind = "lose";
      AudioEngine.sfx.lose();
    } else if (d > 21) {
      payout = stake * 2;
      text = `Dealer busts · +${fmt.format(stake)}`;
      kind = "win";
      AudioEngine.sfx.win();
    } else if (pBJ && dBJ) {
      payout = stake;
      text = "Both blackjack · Push";
      kind = "push";
      AudioEngine.sfx.push();
    } else if (p > d) {
      payout = stake * 2;
      text = `You win · +${fmt.format(stake)}`;
      kind = "win";
      AudioEngine.sfx.win();
    } else if (p < d) {
      text = `Dealer wins · −${fmt.format(stake)}`;
      kind = "lose";
      AudioEngine.sfx.lose();
    } else {
      payout = stake;
      text = "Push · Bet returned";
      kind = "push";
      AudioEngine.sfx.push();
    }

    if (payout > 0) state.bankroll += payout;
    setMessage(text, kind);
    refreshMoney();

    state.phase = "roundOver";
    state.busy = false;
    updateScores();
    updateChipAvailability();

    const broke = state.bankroll < MIN_CHIP;
    els.nextBtn.textContent = broke ? "Reload $1,000" : "Next Hand";
    els.nextBtn.dataset.reload = broke ? "1" : "0";
    setTimeout(() => {
      showPanel("result");
      updateChipAvailability();
    }, 700);
  }

  function nextHand() {
    if (els.nextBtn.dataset.reload === "1") {
      state.bankroll = START_BANK;
      setMessage("Fresh stack · Good luck");
    }
    state.bet = 0;
    state.player = [];
    state.dealer = [];
    state.holeEl = null;
    state.phase = "betting";
    state.busy = false;
    els.dealerCards.innerHTML = "";
    els.playerCards.innerHTML = "";
    els.nextBtn.textContent = "Next Hand";
    els.nextBtn.dataset.reload = "0";
    setMessage("Place your bet");
    showPanel("bet");
    refreshMoney();
    updateScores();
  }

  function wireControls() {
    document.querySelectorAll(".chip").forEach((chipBtn) => {
      chipBtn.addEventListener("click", () => {
        addChip(parseInt(chipBtn.dataset.value, 10));
        chipBtn.blur();
      });
    });

    els.clearBtn.addEventListener("click", () => {
      clearBet();
      els.clearBtn.blur();
    });

    els.dealBtn.addEventListener("click", () => {
      AudioEngine.ensure();
      deal();
      els.dealBtn.blur();
    });

    els.hitBtn.addEventListener("click", () => {
      hit();
      els.hitBtn.blur();
    });

    els.standBtn.addEventListener("click", () => {
      stand();
      els.standBtn.blur();
    });

    els.dblBtn.addEventListener("click", () => {
      doubleDown();
      els.dblBtn.blur();
    });

    els.nextBtn.addEventListener("click", () => {
      nextHand();
      els.nextBtn.blur();
    });

    els.musicBtn.setAttribute("aria-pressed", String(AudioEngine.musicEnabled()));
    els.musicBtn.addEventListener("click", () => {
      const on = AudioEngine.toggleMusic();
      els.musicBtn.setAttribute("aria-pressed", String(on));
      els.musicBtn.blur();
    });

    els.sfxBtn.setAttribute("aria-pressed", String(AudioEngine.sfxEnabled()));
    els.sfxBtn.addEventListener("click", () => {
      const on = AudioEngine.toggleSfx();
      els.sfxBtn.setAttribute("aria-pressed", String(on));
      if (on) AudioEngine.sfx.chip();
      els.sfxBtn.blur();
    });

    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "h") hit();
      else if (key === "s") stand();
      else if (key === "d") doubleDown();
      else if (key === "enter" || e.code === "Space") {
        if (document.activeElement && document.activeElement.tagName === "BUTTON")
          return;
        if (state.phase === "betting" && state.bet > 0) {
          e.preventDefault();
          AudioEngine.ensure();
          deal();
        } else if (state.phase === "roundOver") {
          e.preventDefault();
          nextHand();
        }
      }
    });
  }

  function init() {
    wireControls();
    buildShoe();
    setMessage("Place your bet");
    showPanel("bet");
    refreshMoney();
    updateScores();
  }

  init();
})();
