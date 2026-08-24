# poster-

**Gold Rush** — a two-game browser casino in a self-contained static site:

- **Gold Rush Blackjack** — sleek black & gold blackjack with a smoky
  poker-lounge soundtrack generated live via the Web Audio API.
- **Neon Roulette** — a futuristic single-zero roulette table with an animated
  glowing wheel, full betting board, and the same shared bankroll & music engine.

No audio files, no build step, no dependencies.

## Play now

**Live site: https://kenclarkz.github.io/poster-/**

> Note the trailing dash in the URL — the repo is named `poster-`, so
> `kenclarkz.github.io/poster/` (without the dash) will 404. A custom `404.html`
> auto-redirects mistyped paths under the project back to the casino.

Run it locally by opening `index.html` (blackjack) or `roulette.html` (roulette)
in any browser, or serve the folder statically (`npx serve .`). Hosted via
GitHub Pages — *Deploy from a branch → `main` / `(root)`*.

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

The bankroll persists in `localStorage` and is shared between both games —
winnings at the blackjack table are spendable at the roulette wheel.
Rebuy $1,000 whenever you go broke.
