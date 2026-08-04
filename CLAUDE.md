# ragequit

Fake screen destruction toy for decompressing. Two targets, one engine:
- `packages/extension` — Chrome MV3 extension, destroys the current webpage.
- `packages/desktop` — Electron app, screenshots the desktop and destroys the frozen image.
- `packages/core` — the shared destruction engine. Single source of truth; `npm run sync` copies it into both targets. Never edit the synced copies.

Full roadmap: see the plan (phases F1–F23). Everything is visual-only and local — no data ever leaves the machine.

## Hard rules

- **Git**: Claude NEVER runs `git commit` or `git push`. After each chunk of work, Claude suggests a ready-to-paste commit message; the user commits and pushes.
- **Versioning**: every feature chunk bumps the minor version (0.x.0 while pre-1.0) in ALL of: root `package.json`, `packages/desktop/package.json`, `packages/extension/manifest.json`, and the lockfile (`npm install --package-lock-only`). The commit message includes the version; suggest a matching `git tag vX.Y.Z`.
- **Clarification**: before building any feature, Claude asks at least 5 clarification questions.
- **Zero dependencies**: no bundler, no framework, no runtime deps (Electron + electron-builder are the only dev deps, desktop package only). All art is procedural canvas drawing; all audio is WebAudio synthesis. **Binary-asset exception**: app icons are PNGs, but they are *generated from procedural canvas code* (`scripts/make-icons.html` is the source) — no hand-drawn binary art. Icons live in `packages/extension/icons/` and `packages/desktop/icon.png`.
- **Hardware guts**: `packages/core/guts.js` owns everything *under* the screen. The engine keeps a 16px depth grid and a third canvas below the damage layer; weapons call `api.breach(x, y, radius, amount)` (4th arg of `hit`) to chew deeper. At depth ≥1 the exposed strata (LCD → backlight → PCB → chassis) are painted and the damage layer is punched transparent there. Adding hardware detail means editing `guts.js` only.
- **Weapon contract**: every weapon is one file in `packages/core/tools/` registering `{name, icon, cursor, hit(ctx, x, y, api), sound(ac, dest), reset?(), auto?, frame?(fxCtx, dt, w, h)}` (`dest` = shared compressor, fall back to `ac.destination`; `auto` = ms between repeats while held, engine follows the cursor; `frame` draws transient fx each rAF on the cleared fx canvas and returns truthy while alive; `soundLoop?(ac, dest)` returns a stop-function — held weapons with it roar continuously instead of per-hit `sound()`) (optional `reset` clears tool-local state when the screen resets). Files are number-prefixed (`10-hammer.js`) — sort order = toolbar order. Adding a weapon must not touch engine internals.
- **Idempotency**: the engine IIFE toggles itself off when re-injected (this is how the extension toolbar button toggles).

## Subagents (in `.claude/agents/`) — run at phase gates, not per-feature

- **security-reviewer** — before each release-ish milestone (extension ready, desktop ready, packaging, store submission).
- **fx-designer** — after each new weapon.
- **platform-engineer** — when touching `desktop/main.js` or `manifest.json`.
- **code-reviewer** — at the end of each phase, before its final commit-message suggestion.
