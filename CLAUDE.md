# ragequit

Fake screen destruction toy for decompressing. Two targets, one engine:
- `packages/extension` — Chrome MV3 extension, destroys the current webpage.
- `packages/desktop` — Electron app, screenshots the desktop and destroys the frozen image.
- `packages/core` — the shared destruction engine. Single source of truth; `npm run sync` copies it into both targets. Never edit the synced copies.

Full roadmap: see the plan (phases F1–F23). Everything is visual-only and local — no data ever leaves the machine.

## Hard rules

- **Git**: Claude NEVER runs `git commit` or `git push`. After each chunk of work, Claude suggests a ready-to-paste commit message; the user commits and pushes.
- **Clarification**: before building any feature, Claude asks at least 5 clarification questions.
- **Zero dependencies**: no bundler, no framework, no runtime deps (Electron + electron-builder are the only dev deps, desktop package only). All art is procedural canvas drawing; all audio is WebAudio synthesis; no binary assets.
- **Weapon contract**: every weapon is one file in `packages/core/tools/` registering `{name, icon, cursor, hit(ctx, x, y), sound(ac, dest), reset?()}` (`dest` = shared compressor; connect output there, falling back to `ac.destination`) (optional `reset` clears tool-local state when the screen resets). Files are number-prefixed (`10-hammer.js`) — sort order = toolbar order. Adding a weapon must not touch engine internals.
- **Idempotency**: the engine IIFE toggles itself off when re-injected (this is how the extension toolbar button toggles).

## Subagents (in `.claude/agents/`) — run at phase gates, not per-feature

- **security-reviewer** — before each release-ish milestone (extension ready, desktop ready, packaging, store submission).
- **fx-designer** — after each new weapon.
- **platform-engineer** — when touching `desktop/main.js` or `manifest.json`.
- **code-reviewer** — at the end of each phase, before its final commit-message suggestion.
