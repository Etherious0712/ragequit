# ragequit

Had a rough day? Destroy your screen. Virtually. Nothing real is harmed.

- **Browser extension** (Chrome MV3): smash the webpage you're on — [packages/extension](packages/extension)
- **Desktop app** (Electron): freezes a screenshot of your desktop and lets you wreck it — [packages/desktop](packages/desktop)

Both share one zero-dependency destruction engine: [packages/core](packages/core). All art is procedural canvas drawing, all sound is WebAudio synthesis — no assets, no build step, no data leaves your machine.

## Try it

**Extension**: `chrome://extensions` → Developer mode → Load unpacked → `packages/extension`. Click the toolbar button to arm/disarm.

**Desktop**: `cd packages/desktop && npm install && npm start`. `Esc` quits, `R` resets.

## Development

Engine source lives only in `packages/core`. After editing it:

```
npm run sync   # copies core into extension/ and desktop/
```
