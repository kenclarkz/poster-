# poster-

**Gold Rush** — a self-contained browser casino in a static site with a shared
bankroll and a live-generated Web Audio soundtrack:

- **Gold Rush Blackjack** — sleek black & gold blackjack with a smoky
  poker-lounge soundtrack.
- **Neon Roulette** — a futuristic single-zero roulette table with an animated
  glowing wheel, full betting board.
- **Arcade Casino** — a neon arcade with **14 playable mini-games**, all
  sharing the same bankroll and sound engine.

No audio files, no build step, no dependencies.

## Play now

**Live site: https://kenclarkz.github.io/poster-/**

> Note the trailing dash in the URL — the repo is named `poster-`, so
> `kenclarkz.github.io/poster/` (without the dash) will 404. A custom `404.html`
> auto-redirects mistyped paths under the project back to the casino.

Run it locally (open `arcade.html` for the hub, `index.html` for blackjack, or
`roulette.html` for roulette) in any browser, or serve the folder statically
(`npx serve .`). Hosted via GitHub Pages — *Deploy from a branch → `main` / `(root)`*.

## The Arcade Casino

Reach it via **Arcade** in the game nav (or `arcade.html`). It lists 14
mini-games that wager the same shared bankroll:

| Game | What it is | Highlights |
| --- | --- | --- |
| Coin Pusher | Drop coins onto a ledge | Prizes & jackpot stack |
| Lucky Wheel | Spin a 12-slice wheel | Up to 20&times; |
| Basketball Hoops | Time a power meter | Swish pays 3&times; |
| Skee-Ball | Roll into scoring rings | Up to 5&times; |
| Claw Machine | Move & drop the claw | Grab a prize |
| Ticket Blaster | Blast flying tickets | Gold tickets 5&times; |
| Jackpot Drop | Drop a gem through pegs | Up to 12&times; |
| Plinko | Classic pachinko cascade | Up to 15&times; |
| Horse Racing | Back a horse, watch it run | Up to 7:1 odds |
| Arcade Slots | Pull the lever on 3 reels | Jackpot 100&times; |
| Reaction Game | Reflex timing test | Fast = 5&times; |
| Whack-a-Mole | Whack moles, dodge bombs | Per mole paid |
| Bowling | Aim + power a roll | Strike 3&times; |
| Blackjack Arcade | Same table game, arcade link | 3:2 |

Every game is actually playable with animations, synthesized sound effects
(via `SoundKit`), scoring, multipliers, and payments against the shared
`grbj-bankroll` wallet.

## Blackjack house rules

- 6-deck shoe, reshuffled automatically
- Blackjack pays 3:2 · dealer stands on all 17s
- Bet with 5 / 25 / 100 / 500 chips, then hit, stand, or double down

| Key | Action |
| --- | --- |
| `H` | Hit |
| `S` | Stand |
| `D` | Double down |
| `Enter` | Deal / next round |

## Roulette rules

- European single-zero wheel (37 pockets), straight-up pays 35:1
- Full felt: all 37 numbers, dozens, columns, red/black, even/odd, 1–18/19–36
- Click chips to pick a denomination, click the felt to place bets,
  undo/clear before spinning; outside bets pay even money or 2:1

| Key | Action |
| --- | --- |
| `Space` / `Enter` | Spin / next round |
| `C` | Clear bets |
| `Z` | Undo last chip |

## Shared bankroll

The bankroll persists in `localStorage` and is shared across **every** game —
blackjack, roulette, and all 14 arcade games. Winnings anywhere are spendable
everywhere else. Rebuy $1,000 whenever you go broke.
