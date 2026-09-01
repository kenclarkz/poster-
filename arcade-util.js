(() => {
  'use strict';

  const BANK_KEY = 'grbj-bankroll';
  const MIN_CHIP = 5;
  const DEFAULT_BANKROLL = 1000;

  function loadBankroll() {
    try {
      const v = parseInt(localStorage.getItem(BANK_KEY), 10);
      return Number.isFinite(v) && v >= 0 ? v : null;
    } catch {
      return null;
    }
  }

  function save(bankroll) {
    try { localStorage.setItem(BANK_KEY, String(bankroll)); } catch { /* ignore */ }
  }

  function fmt(n) {
    return '$' + n.toLocaleString('en-US');
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function rand(n) {
    return Math.floor(Math.random() * n);
  }

  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[rand(arr.length)];
  }

  window.Arcade = {
    BANK_KEY,
    MIN_CHIP,
    DEFAULT_BANKROLL,
    loadBankroll,
    save,
    fmt,
    sleep,
    rand,
    randBetween,
    pick,
  };
})();
