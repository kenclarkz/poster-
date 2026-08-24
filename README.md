# poster-

**Gold Rush Blackjack** — a sleek browser blackjack game in black & gold, with a
smoky poker-lounge soundtrack generated live via the Web Audio API (no audio files needed).

## Play now

**Live site: https://kenclarkz.github.io/poster-/**

> Note the trailing dash in the URL — the repo is named `poster-`, so
> `kenclarkz.github.io/poster/` (without the dash) will 404. A custom `404.html`
> auto-redirects mistyped paths under the project back to the game.

The game **is** a self-contained web page — no build step, no dependencies.

- **Instantly:** open `index.html` in any browser (double-click it), or serve the
  folder statically (`npx serve .`).
- **Hosted:** served via GitHub Pages — *Deploy from a branch → `main` / `(root)`*.

## House rules

- 6-deck shoe, reshuffled automatically
- Blackjack pays 3:2 · dealer stands on all 17s
- Bet with 5 / 25 / 100 / 500 chips, then hit, stand, or double down
- Bankroll persists in `localStorage` (rebuy when you go broke)

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `H` | Hit |
| `S` | Stand |
| `D` | Double down |
| `Enter` | Deal / next round |
