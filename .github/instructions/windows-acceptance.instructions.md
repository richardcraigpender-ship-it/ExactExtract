---
description: "Use when packaging, testing, or reviewing Windows Electron behavior, lifecycle acceptance, OCR packaging, recovery, accessibility acceptance, or release artifacts."
name: "ExactExtract Windows Acceptance"
applyTo: ["electron-builder*.yml", "scripts/**/*.{ps1,mjs,ts}", "docs/*acceptance*.md", "docs/release-readiness.md", "package.json"]
---
# Windows Acceptance Guidelines

- The declared target is Windows 10/11 x64. Current product identity is `ExactExtract`, app ID `com.exactextract.app`, and executable identity `exact-extract.exe` for compatibility.
- Avoid concurrent Electron, installer, lifecycle, or packaging processes; file locks can invalidate results.
- Use `npm run build:win-beta` for a fresh candidate. Verify the installer, executable, ASAR, OCR package, and SHA-256 evidence before reporting success.
- Treat product identity changes as one coordinated change: update `electron-builder*.yml`, artifact-name expectations, lifecycle/effective-config verification, release manifests, and user-facing What’s new/docs together.
- Use `npm run verify:windows-lifecycle` for per-user install, launch, isolated profile creation, reinstall, uninstall, shortcut/registration/process cleanup, and retained user-data checks.
- Keep unsigned-installer and SmartScreen warnings explicit. Never claim Authenticode signing when the artifact is unsigned.
- Distinguish executable evidence from manual boundaries: clean-account/VM behavior, human-audible Narrator output, and the complete installed Import -> OCR -> Review -> Export -> reopen workflow require explicit manual classification.
- OCR must remain offline and bundled. Preserve worker termination, PDF document destruction, raster-canvas cleanup, cancellation, and packaged asset verification.
- Do not commit `out/`, `dist-*`, installer artifacts, generated OCR assets, temporary acceptance output, or lifecycle profiles.
- Update [docs/release-readiness.md](../../docs/release-readiness.md), [docs/agent-b-acceptance-matrix.md](../../docs/agent-b-acceptance-matrix.md), and [docs/accessibility-audit.md](../../docs/accessibility-audit.md) only with evidence from the current candidate and environment.
