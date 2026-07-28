# Releasing

Both targets ship from the same version number. Bump it in **all** of
`package.json`, `packages/desktop/package.json`, `packages/extension/manifest.json`
and the lockfile (`npm install --package-lock-only`) before tagging.

## 1. Build the artifacts

```
npm install
```

(A real install — the lockfile-only step used during version bumps doesn't fetch the
build toolchain.)

```
npm run dist -w ragequit-desktop
```

→ `packages/desktop/dist/ragequit Setup 1.0.0.exe` (Windows NSIS installer, unsigned)

```
npm run zip:ext
```

→ `dist/ragequit-extension.zip` (Chrome Web Store upload package)

## 2. Cut the GitHub Release

The desktop app's update check reads the **latest release tag** from the GitHub API,
so the tag must be `vX.Y.Z` and the installer must be attached for the Download button
to lead anywhere useful.

```
git tag v1.0.0
git push origin master --tags
```

```
gh release create v1.0.0 "packages/desktop/dist/ragequit Setup 1.0.0.exe" --title "ragequit v1.0.0" --notes "First public release."
```

Verify the update check can see it:

```
gh api repos/Etherious0712/ragequit/releases/latest --jq .tag_name
```

## 3. Submit the extension (first time only)

Chrome Web Store Developer Dashboard → upload `dist/ragequit-extension.zip`, then paste
the listing copy from [packages/extension/STORE.md](packages/extension/STORE.md) and add
1280×800 screenshots. Requires a developer account and the one-time $5 registration fee.

Updates afterwards: bump the version, re-run `npm run zip:ext`, upload the new zip as a
new package version.

## Notes

- The installer is **unsigned** — Windows SmartScreen shows an "unknown publisher"
  prompt on first run. Code signing needs a paid certificate; skipped deliberately.
- The update check never auto-installs. It only notices a newer release and offers to
  open the releases page — that's what keeps the project at zero runtime dependencies.
- `npm audit` currently reports a high-severity advisory in `brace-expansion`, pulled in
  transitively by `electron-builder`. It is **build-time only** — nothing shipped to
  users includes it (the extension and the packaged app both have zero runtime
  dependencies). No compatible patched version exists yet for the ranges the toolchain
  pins, and npm's suggested "fix" is a downgrade of electron-builder, which is worse. It
  will clear when electron-builder updates its own tree.
