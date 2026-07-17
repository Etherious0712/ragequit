# ragequit

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

A speaker button at the bottom of the toolbar mutes/adjusts volume (remembered across sessions).

## Try it

**Extension**: `chrome://extensions` → Developer mode → Load unpacked → `packages/extension`. Click the toolbar button to arm/disarm on the current page.

**Desktop**: `cd packages/desktop && npm install && npm start`. It captures the monitor under your cursor and lets you destroy the frozen image. `Esc` quits, `R` resets.

## Development

Engine source lives only in `packages/core`. After editing it:

```
npm run sync   # copies the concatenated engine into extension/ and desktop/
```

App icons are generated from procedural canvas code — open `scripts/make-icons.html` to regenerate them; there are no hand-drawn binary assets.
