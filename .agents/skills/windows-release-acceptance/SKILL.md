---
name: windows-release-acceptance
description: "Use when building, verifying, or reviewing the ExactExtract Windows beta candidate, installer lifecycle, packaged OCR, artifact hashes, or release acceptance evidence."
---

# Windows Release Acceptance

Use this skill for Windows beta packaging and installed lifecycle verification. Work from a clean, isolated candidate and keep release evidence reproducible.

## Preconditions

- Target Windows 10/11 x64.
- Confirm no `electron.exe` or `exact-extract.exe` process is using the candidate or install directory.
- Do not run concurrent Electron, installer, or packaging processes because Windows file locks can invalidate acceptance.
- Remove a stale per-user `EXACT EXTRACT` installation before lifecycle acceptance; the verifier intentionally fails when one is registered.

## Candidate Gate

Run the narrowest relevant checks first. For a release candidate, use:

```powershell
npm test
npm run typecheck
npm run build:win-beta
npm run verify:ocr-package -- dist-windows-beta/win-unpacked/resources/app.asar
npm run verify:windows-lifecycle
```

`build:win-beta` creates the unpacked candidate and installer under `dist-windows-beta/` and runs Windows beta artifact verification. The lifecycle script then verifies silent install, uninstall registration, installed launch, isolated profile creation, candidate hash parity, clean close, same-version reinstall, quiet uninstall, shortcut/process cleanup, and retained user data.

## Evidence

- Treat `dist-windows-beta/release-manifest.json` and `lifecycle-manifest.json` as candidate evidence; do not commit generated artifacts.
- The installer and executable are unsigned in beta. Verify SHA-256 against the release manifest before bypassing SmartScreen.
- Packaged OCR verification does not replace interactive OCR, Narrator speech, clean-account/VM, or quantitative heap acceptance.
- Link to [release readiness](../../../docs/release-readiness.md), [acceptance matrix](../../../docs/agent-b-acceptance-matrix.md), and [beta support](../../../docs/beta-support-and-privacy.md) for the complete decision context.
