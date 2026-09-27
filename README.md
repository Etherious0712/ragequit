# ragequit

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4)
![Electron](https://img.shields.io/badge/Electron-43-47848F)
![Dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen)

Had a rough day? Destroy your screen. Virtually. Nothing real is harmed.

- **Browser extension** (Chrome MV3): smash the webpage you're on — [packages/extension](packages/extension)
- **Desktop app** (Electron): freezes a screenshot of your desktop and lets you wreck it — [packages/desktop](packages/desktop)

Both share one zero-dependency destruction engine: [packages/core](packages/core). All art is procedural canvas drawing, all sound is WebAudio synthesis — no build step, no data leaves your machine.

## Arsenal

Pick a weapon from the slim toolbar on the left edge (hover to reveal it), or press its number key. `R` resets, `Esc` quits.

| # | Weapon | What it does |
|---|--------|--------------|
| 1 | **Hammer** | Click to smash a dent with radiating cracks. |
| 2 | **Glass cracks** | Radial shatter; hits near an existing break grow connecting cracks. |
| 3 | **Gun** | Bullet holes with torn rims and ±6px recoil spread. |
| 4 | **Machine gun** | Hold to auto-fire ~8/sec with climbing recoil; brass casings bounce. |
| 5 | **Flamethrower** | Hold to burn — rising flames char the screen black; smoke lingers. |
| 6 | **Chainsaw** | Hold + drag to carve a ragged rip; wood chips fly, motor revs with speed. |
| 7 | **Paintball** | Random-color splats with running drips. |
| 8 | **Laser** | Hold to fire a beam from the top edge that slices a molten cut. |
| 9 | **Termites** | Drop a swarm that wanders and gnaws holes on its own. |
| 0 | **Dynamite** | Plant a stick with a burning fuse — flash, screen-shake, crater, cracks to the edges. |

## Break all the way down the OSI stack

Damage has depth, and the layers are the OSI model. The screen you're looking at is
**L7 Application**. Keep working the same spot and you dig down one layer at a time:
**L6 Presentation** (JPEG blocks, hex dumps, mojibake), **L5 Session** (keep-alive links,
session tokens), **L4 Transport** (SYN/ACK segments, ports), **L3 Network** (a routing graph
of IP addresses), **L2 Data Link** (raw bitstream, MAC addresses) and finally
**L1 Physical** (the circuit board, twisted copper, a snapped fibre, the bare chassis). A HUD
in the top-right corner shows the deepest layer you've reached. Sparks spit from fresh
breaches, shards drop away, and ribbon cables dangle out of the deep tears.

Once the screen is breached, the exposed electronics hum (louder the more you've torn
open) and crackle with random arcs of sparks.

Every weapon digs at its own rate: a bullet punches through in a couple of shots, dynamite
craters straight to L1, termites slowly eat their way in, and paintball never gets
past the surface — it's paint.

The toolbar also has a 📷 button to save a screenshot of your carnage (page/desktop + damage composited into a PNG), a ✉ button to send feedback (opens a pre-filled draft in your mail app), and a speaker button to mute or adjust volume (remembered across sessions).

## Try it

**Extension**: `chrome://extensions` → Developer mode → Load unpacked → `packages/extension`. Click the toolbar button to arm/disarm on the current page.

**Desktop**: `cd packages/desktop && npm install && npm start`. It captures the monitor under your cursor and lets you destroy the frozen image. `Esc` quits, `R` resets.

## Privacy

ragequit collects nothing and transmits nothing. There are no accounts, no analytics,
and no network requests — all art is drawn on the fly and all sound is synthesized in
the browser. The extension only touches a page after you click its toolbar button
(`activeTab`), and the "save screenshot" feature composites the image locally and hands
it straight to your browser's download; it is never uploaded anywhere. The desktop app's
only network call is an optional check of GitHub Releases for a newer version.
The "send feedback" button just opens a pre-filled draft in *your* mail app (a
`mailto:` link, with the app version and browser user agent in the body); nothing is
sent unless you review it and press send yourself.

## Development

Engine source lives only in `packages/core`. After editing it:

```
npm run sync   # copies the concatenated engine into extension/ and desktop/
```

App icons are generated from procedural code — no hand-drawn binary assets:

```
npm run icons   # → extension 16/48/128 + desktop 512, via scripts/make-icons.js
```

`scripts/make-icons.js` rasterises the mark itself and encodes the PNGs with Node's
built-in zlib (zero dependencies, byte-reproducible). `scripts/make-icons.html` renders
the same design in a browser and is kept purely as a visual playground.

### Packaging the desktop app

From the repo root run a real `npm install` (the build toolchain isn't fetched by the lockfile-only step), then:

```
npm run dist -w ragequit-desktop   # → packages/desktop/dist/ (Windows NSIS installer)
```

The build is unsigned, so Windows SmartScreen shows an "unknown publisher" prompt once. The installed app checks GitHub Releases for updates on launch and offers a download link when a newer version exists (no silent auto-install — keeps the zero-dependency rule).

Full build-and-publish steps: [RELEASING.md](RELEASING.md).

### Adding a weapon

Drop one file in `packages/core/tools/` (number-prefixed — the sort order is the toolbar
order) that registers into the global registry:

```js
(window.__SMASH_TOOLS__ = window.__SMASH_TOOLS__ || []).push({
  name: 'my weapon',
  icon(ctx, size) { /* draw the 24px toolbar icon */ },
  cursor(makeCanvas) { return { idle: 'url(...) 16 16, crosshair', swung: '...' }; },
  hit(ctx, x, y) { /* paint damage onto the persistent canvas */ },
  sound(ac, dest) { /* synthesize the impact */ },
  // optional: auto (ms between repeats while held), frame(fxCtx, dt, w, h) for
  // transient particles, soundLoop(ac, dest) → stop-fn, reset() to clear state
});
```

Then `npm run sync`. No engine internals to touch.

## Contributing

Issues and PRs welcome. Two house rules that keep this thing small:

- **Zero runtime dependencies** — art is procedural canvas drawing, audio is WebAudio
  synthesis, no bundler, no framework. (Electron and electron-builder are dev-only.)
- **Edit `packages/core` only** — the copies in `packages/extension` and
  `packages/desktop` are generated by `npm run sync`.

## License

[MIT](LICENSE) © Etherious0712

