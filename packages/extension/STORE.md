# Chrome Web Store listing — copy & submission notes

Everything here is ready to paste into the Chrome Web Store Developer Dashboard.
You do the actual upload (needs your developer account + the one-time $5 fee).

Build the upload zip first:

```
npm run zip:ext   # → dist/ragequit-extension.zip
```

---

## Listing fields

**Name**
`ragequit — smash the page`

**Summary** (132 char max)
`Had a rough day? Smash the webpage you're on with hammers, lasers, dynamite and more. Fake, fun, and completely local.`

**Category**
Fun

**Language**
English

**Detailed description**
```
Rough day? Take it out on the internet.

ragequit turns any webpage into something you can wreck — no consequences, nothing
real is harmed, and not one byte leaves your machine. Click the toolbar button to
arm it, then go to town:

🔨 Hammer — smash dents with spreading cracks
🪟 Glass cracks — shatter the screen like it's real glass
🔫 Gun & machine gun — bullet holes with recoil
🔥 Flamethrower — hold to char the page black
🪚 Chainsaw — drag to carve a ragged rip
🎨 Paintball — colorful splats and drips
⚡ Laser — a beam that slices a molten cut
🐛 Termites — a swarm that eats holes on its own
🧨 Dynamite — plant a fuse, then flash-bang-crater the whole screen

Save a screenshot of your carnage with one click. Mute or tune the sound. Hit R to
reset, Esc to quit. That's it — no accounts, no tracking, no data collection.

Everything is drawn and synthesized on the fly (procedural canvas + WebAudio), so
the whole thing is tiny and works entirely offline.
```

---

## Privacy practices tab (required)

**Single purpose** (one sentence)
```
ragequit is a stress-relief toy that draws fake destruction effects over the current
web page when the user activates it from the toolbar.
```

**Permission justifications**
- **activeTab** — `ragequit only touches a page after the user clicks its toolbar button. activeTab grants temporary access to that one tab so the destruction overlay can be injected, and lets the "save screenshot" button capture the visible tab for the user to download.`
- **scripting** — `Used to inject the self-contained destruction script into the active tab when the user clicks the toolbar button. No scripts are injected automatically or in the background.`

**Data usage disclosures** — check *none*:
- Does NOT collect or transmit any user data.
- Does NOT use remote code (everything ships in the package; no external scripts/fetches).
- The "save screenshot" feature composites the image locally and hands it to the
  browser's download — it is never uploaded anywhere.

**Privacy policy URL** — the store may require one even though no data is handled.
Point it at the repo's privacy note:
`https://github.com/Etherious0712/ragequit#privacy`
(Add a short "## Privacy" section to the README saying ragequit collects and transmits
nothing, if it isn't there yet.)

---

## Screenshots

Google requires **1280×800** (or 640×400) PNG/JPEG, 1–5 images.

There's a generator that produces them at exactly 1280×800 — no cropping, no OS
screenshot tool. Open this file in Chrome:

```
packages/core/shots.html
```

It draws a realistic mock news page, runs the real engine on top, and gives you preset
scene buttons. For each one: click the scene, then click **⬇ download**. The PNG lands in
your Downloads folder at exactly 1280×800.

| Button | Shows |
|---|---|
| 1 mixed | glass, bullet holes, a hammered breach and paint splats together |
| 2 hardware | one spot dug clean through — LCD, backlight, PCB, chassis |
| 3 machine gun | a sweeping burst with bullet holes and brass casings |
| 4 burn | flamethrower char and smoke plus a chainsaw gash |
| 5 dynamite | crater and edge cracks (wait ~2s for the fuse, *then* download) |

Scenes 1 and 2 are the strongest first two images — 2 is the one that shows off what makes
this different from every other "crack the screen" toy.

The engine's toolbar is hidden in these composites (they're page + damage + guts only), so
if you want one shot showing the weapon picker, take that one manually with the extension
loaded in Chrome.

A 440×280 (small) or 1400×560 (marquee) promo tile is optional but helps the listing.
