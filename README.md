# Set

A single-page implementation of the card game **Set**, built with [Mithril.js](https://mithril.js.org/) and SVG. No build step, no other libraries.

## Run locally (no Docker)

Open `index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 8765
# then visit http://localhost:8765/
```

## Run with Docker

```bash
docker build -t set .
docker run --rm -p 8080:80 set
# then visit http://localhost:8080/
```

The image is based on `nginx:alpine` and serves the app's static files. All asset paths are relative, so the app works whether it is hosted at `/`, `/set/`, or any other base path behind a reverse proxy.

## Files

- `index.html` &mdash; HTML shell + embedded CSS, mounts the Mithril app.
- `vendor/mithril.min.js` &mdash; Mithril 2.2.2, vendored locally.
- `game.js` &mdash; Pure game logic: deck, `isSet()`, `boardHasSet()`, `findSet()`, `newGame()`.
- `card.js` &mdash; Mithril `CardView` component that renders each card via SVG.
- `app.js` &mdash; Top-level component: board, selection, "Add 3 cards", flash animations, "New game".
- `Dockerfile` / `nginx.conf` &mdash; container packaging.

## Rules implemented

- Standard 81-card deck (3&times; count, shape, color, shading).
- Initial board of 12 cards laid out as **4 rows &times; 3 columns**.
- Click a card to toggle its selection; selecting 3 auto-validates.
- Valid set: brief green pulse, cards removed and (if board was 12) replaced from the deck.
- Invalid set: brief red pulse, cards deselected, board unchanged.
- **Add 3 cards** button: appends a new row of 3, but only if there is no set currently on the board. If a set is present (or the deck is too low), the board pulses amber and the action is refused.
- After an extra row has been added, completing a set anywhere on the board removes those 3 cards without dealing new ones &mdash; the remaining cards re-flow to fill the gap so the board returns to 12 (4&times;3).
- When the deck is empty and no set remains on the board, the game shows "Game over".
