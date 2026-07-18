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

## Screenshots (you capture these — I can't produce store-grade binaries here)

Google requires **1280×800** (or 640×400) PNG/JPEG, 1–5 images. Suggested set:

1. Load the extension unpacked in real Chrome (`chrome://extensions` → Developer
   mode → Load unpacked → `packages/extension`).
2. Open a bright, busy page (a news site or a colorful demo page reads best).
3. Click the toolbar button to arm ragequit. Resize the window to ~1280×800.
4. Capture 3–5 shots, each showing a different weapon mid-carnage:
   - glass cracks spidering across an article,
   - a machine-gun spray with casings,
   - flamethrower char + smoke,
   - a dynamite crater with edge cracks,
   - the left toolbar visible so people see the weapon picker.
5. Use the OS screenshot tool or the extension's own 📷 save button, then crop to
   exactly 1280×800.

A 440×280 (small) or 1400×560 (marquee) promo tile is optional but helps the listing.
