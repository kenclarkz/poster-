# poster-

**Gold Rush Blackjack** — a sleek browser blackjack game in black & gold, with a
smoky poker-lounge soundtrack generated live via the Web Audio API (no audio files needed).

## Play

Open `index.html` directly in a browser, serve the folder statically (e.g. `npx serve .`),
or enable GitHub Pages.

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
