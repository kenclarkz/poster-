(() => {
  'use strict';

  const GAMES = [
    { id: 'coinpusher', emoji: '🪙', name: "Ken's Coin Pusher", tagline: 'Drop coins, push the ledge, grab the jackpot.', pay: 'Win 2x+', href: 'games/coinpusher.html' },
    { id: 'luckywheel', emoji: '🎡', name: "Ken's Wheel of Fortune", tagline: 'Spin the wheel of fortune. Big multiplier swings.', pay: 'Up to 20x', href: 'games/luckywheel.html' },
    { id: 'basketball', emoji: '🏀', name: "Ken's Hoops", tagline: 'Shoot for swish. Time your release perfectly.', pay: 'Swish 3x', href: 'games/basketball.html' },
    { id: 'skeeball', emoji: '🎳', name: "Ken's Skee-Ball", tagline: 'Toss the ball into scoring rings.', pay: '50 up to 500', href: 'games/skeeball.html' },
    { id: 'clawmachine', emoji: '🧸', name: "Ken's Claw", tagline: 'Line up the claw, drop it, capture the prize.', pay: 'Prize 20x', href: 'games/clawmachine.html' },
    { id: 'ticketblaster', emoji: '🎟️', name: "Ken's Ticket Blaster", tagline: 'Blast tickets as they fly by before time runs out.', pay: 'Per ticket', href: 'games/ticketblaster.html' },
    { id: 'jackpotdrop', emoji: '💎', name: "Ken's Jackpot Drop", tagline: 'Drop gems through pegs into the million payout.', pay: 'Up to 12x', href: 'games/jackpotdrop.html' },
    { id: 'plinko', emoji: '🎾', name: "Ken's Plinko", tagline: 'Classic pachinko. Watch the ball cascade.', pay: 'Up to 15x', href: 'games/plinko.html' },
    { id: 'horseracing', emoji: '🐎', name: "Ken's Royal Derby", tagline: 'Pick your steed and watch the photo finish.', pay: 'Up to 8x', href: 'games/horseracing.html' },
    { id: 'arcadeslots', emoji: '🎰', name: "Ken's Slots", tagline: 'Three neon reels. Match to win big.', pay: 'Jackpot 100x', href: 'games/arcadeslots.html' },
    { id: 'reaction', emoji: '⚡', name: "Ken's Reaction", tagline: 'Wait for the green flash. Click as fast as you can.', pay: 'Fast = big', href: 'games/reaction.html' },
    { id: 'whackamole', emoji: '🔨', name: "Ken's Whack-a-Mole", tagline: 'Whack moles, dodge bombs, beat the clock.', pay: 'Per mole', href: 'games/whackamole.html' },
    { id: 'bowling', emoji: '🎯', name: "Ken's Bowling", tagline: 'Aim your shot and bowl a strike.', pay: 'Strike 3x', href: 'games/bowling.html' },
    { id: 'blackjack', emoji: '♠', name: "Ken's Blackjack", tagline: 'Same action, arcade neon twist.', pay: '3:2', href: 'index.html' },
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
