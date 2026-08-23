# poster- · Blackjack

A clean single-page blackjack game in black & gold, with synthesized lounge poker music.

## Play

Open `index.html` directly in a browser, or serve the folder:

```bash
npx serve .
```

No build step, no dependencies.

## Features

- Full blackjack vs. dealer: Hit, Stand, Double Down
- Blackjack pays 3:2 · Dealer stands on all 17s · 6-deck shoe with auto reshuffle
- Chip betting ($10–$500) with persistent bankroll (localStorage)
- Black & gold casino design, card flip and deal animations, responsive layout
- Generated lounge-jazz soundtrack (walking bass, comping, brushed drums) plus card/chip/win sounds via Web Audio API — no audio files needed
- Music & SFX toggles, keyboard shortcuts (`H` hit, `S` stand, `D` double, `Enter` deal / next)

## Structure

```
index.html      page markup
css/style.css   theme + animations
js/audio.js     music generator + sound effects engine
js/game.js      game state machine and UI logic
```
