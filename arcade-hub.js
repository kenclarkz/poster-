(() => {
  'use strict';

  const GAMES = [
    { id: 'coinpusher', emoji: '🪙', name: 'Coin Pusher', tagline: 'Drop coins, push the ledge, grab the jackpot.', pay: 'Win 2x+', href: 'games/coinpusher.html' },
    { id: 'luckywheel', emoji: '🎡', name: 'Lucky Wheel', tagline: 'Spin the wheel of fortune. Big multiplier swings.', pay: 'Up to 20x', href: 'games/luckywheel.html' },
    { id: 'basketball', emoji: '🏀', name: 'Basketball Hoops', tagline: 'Shoot for swish. Time your release perfectly.', pay: 'Swish 3x', href: 'games/basketball.html' },
    { id: 'skeeball', emoji: '🎳', name: 'Skee-Ball', tagline: 'Toss the ball into scoring rings.', pay: '50 up to 500', href: 'games/skeeball.html' },
    { id: 'clawmachine', emoji: '🧸', name: 'Claw Machine', tagline: 'Line up the claw, drop it, capture the prize.', pay: 'Prize 20x', href: 'games/clawmachine.html' },
    { id: 'ticketblaster', emoji: '🎟️', name: 'Ticket Blaster', tagline: 'Blast tickets as they fly by before time runs out.', pay: 'Per ticket', href: 'games/ticketblaster.html' },
    { id: 'jackpotdrop', emoji: '💎', name: 'Jackpot Drop', tagline: 'Drop gems through pegs into the million payout.', pay: 'Up to 12x', href: 'games/jackpotdrop.html' },
    { id: 'plinko', emoji: '🎾', name: 'Plinko', tagline: 'Classic pachinko. Watch the ball cascade.', pay: 'Up to 15x', href: 'games/plinko.html' },
    { id: 'horseracing', emoji: '🐎', name: 'Horse Racing', tagline: 'Pick your steed and watch the photo finish.', pay: 'Up to 8x', href: 'games/horseracing.html' },
    { id: 'arcadeslots', emoji: '🎰', name: 'Arcade Slots', tagline: 'Three neon reels. Match to win big.', pay: 'Jackpot 100x', href: 'games/arcadeslots.html' },
    { id: 'reaction', emoji: '⚡', name: 'Reaction Game', tagline: 'Wait for the green flash. Click as fast as you can.', pay: 'Fast = big', href: 'games/reaction.html' },
    { id: 'whackamole', emoji: '🔨', name: 'Whack-a-Mole', tagline: 'Whack moles, dodge bombs, beat the clock.', pay: 'Per mole', href: 'games/whackamole.html' },
    { id: 'bowling', emoji: '🎯', name: 'Bowling', tagline: 'Aim your shot and bowl a strike.', pay: 'Strike 3x', href: 'games/bowling.html' },
    { id: 'blackjack', emoji: '♠', name: 'Blackjack Arcade', tagline: 'Same action, arcade neon twist.', pay: '3:2', href: 'index.html' },
  ];

  function buildRack() {
    const rack = document.getElementById('rack');
    const frag = document.createDocumentFragment();
    GAMES.forEach((g) => {
      const a = document.createElement('a');
      a.className = 'game-card';
      a.href = g.href;
      a.innerHTML =
        `<span class="emoji" aria-hidden="true">${g.emoji}</span>` +
        `<h2>${g.name}</h2>` +
        `<span class="tagline">${g.tagline}</span>` +
        `<span class="pay">${g.pay}</span>`;
      frag.appendChild(a);
    });
    rack.replaceChildren(frag);
  }

  function renderStats() {
    const bankroll = Arcade.loadBankroll() ?? Arcade.DEFAULT_BANKROLL;
    document.getElementById('bankroll').textContent = Arcade.fmt(bankroll);
  }

  const music = document.getElementById('music-toggle');
  music.addEventListener('click', () => {
    const on = SoundKit.toggleMusic();
    music.textContent = on ? '\u266A MUSIC ON' : '\u266A MUSIC OFF';
    music.classList.toggle('on', on);
  });

  buildRack();
  renderStats();
})();
