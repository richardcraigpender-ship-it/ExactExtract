# Project Guidelines

## Architecture

- This is a Windows-first Electron 41 + Electron-Vite + React 19 + TypeScript desktop app.
- Main-process responsibilities include filesystem access, dialogs, IPC, persistence, exports, and lifecycle guards. Keep these in `src/main/`.
- Renderer code lives in `src/renderer/src/`; access main-process capabilities only through the typed `contextBridge` in `src/preload/index.ts` and `src/preload/index.d.ts`.
- Keep the preload bridge implementation and declarations synchronized; update both files for every IPC or renderer-facing API change.
- Shared contracts belong in `src/shared/`. Extraction/OCR, review, analysis, and export remain separate domain areas under `src/extraction/`, `src/ocr/`, `src/review/`, `src/analysis/`, and `src/export/`.
- Treat `src/renderer/src/App.tsx` as composition/wiring. Put domain logic in the owning module rather than adding more logic there.

## Build and Test

- Install: `npm install`
- Development: `npm run dev`
- Typecheck: `npm run typecheck`
- Tests: `npm test` (serial test concurrency is intentional for Windows stability)
- Lint: `npm run lint`
- Build: `npm run build`
- Windows beta package and verification: `npm run build:win-beta`
- Windows lifecycle acceptance: `npm run verify:windows-lifecycle`
- Offline/packaged OCR checks: `npm run verify:ocr-offline`, `npm run verify:ocr-fixtures`, and `npm run verify:ocr-package -- dist-windows-beta/win-unpacked/resources/app.asar`
- Sprint 0 performance baseline: `npm run benchmark:sprint0`

Run the narrowest relevant test first, then typecheck. Use the full release gates for packaging or release changes. See [README.md](README.md), [docs/release-readiness.md](docs/release-readiness.md), and [docs/agent-b-acceptance-matrix.md](docs/agent-b-acceptance-matrix.md).

## Conventions

- Preserve local-first behavior: PDFs, OCR, project data, and payee/merchant data stay on the device.
- OCR is offline and bundled for English, Spanish, French, and German. Preserve cancellation, PDF cleanup, raster-canvas cleanup, and worker termination.
- Projects store source PDF paths, not embedded PDFs. Missing sources must be explicitly relinked; do not add fuzzy automatic source guessing.
- Persistence uses schema validation, migrations, queued writes, and atomic replacement. Test live in-memory state separately from save/reload state.
- Preserve raw extracted text, source regions, and auditability when adding normalization or rules. Never silently discard source evidence.
- Treat `SourceRegion` traceability fields as part of the source of truth; preserve them through normalization, review, persistence, and export.
- Add project schema changes through the migration map in `src/shared/projectSchema.ts`, with one version bump per migration and backward-compatible handling of older projects.
- Extend `MerchantStore`/`src/shared/merchants.ts` for merchant features; do not extend the legacy `PayeeStore` path for new work. See [docs/sprint-0-shared-contracts.md](docs/sprint-0-shared-contracts.md).
- Keep reference lines separate from payee/description lines in exports. Render-only clipping is acceptable when a reference needs protected space; never mutate stored source text.
- Use ASCII by default in edits, preserve existing line endings/style, and avoid unrelated formatting churn.
- Do not commit generated OCR assets, `out/`, `dist-*`, installer artifacts, or temporary acceptance output.

## Agent Coordination

- Before parallel work, agree on the TypeScript/data contract, owner module, IPC shape, schema impact, and acceptance commands.
- Do not make broad opportunistic edits in another agent's owned subsystem or in `App.tsx` while that surface is actively owned elsewhere.
- Record meaningful handoffs in the project coordination docs. The sprint plan and acceptance evidence live in [docs/product-roadmap-sprints.md](docs/product-roadmap-sprints.md) and [docs/sprint-0-baselines.md](docs/sprint-0-baselines.md).

## Windows Packaging

- Current beta product name is `ExactExtract`, app ID is `com.exactextract.app`, and executable identity remains `exact-extract.exe` for compatibility.
- Windows artifacts are written to `dist-windows-beta/`. The installer is unsigned; verify its SHA-256 before bypassing SmartScreen.
- Avoid concurrent Electron, installer, or packaging processes because file locks can invalidate lifecycle checks.
- The lifecycle verifier covers per-user install, launch, isolated profile creation, reinstall, uninstall, shortcuts, registration, processes, and retained user data. Clean-account/VM and human-audible Narrator acceptance remain manual boundaries.

## Documentation

Link to existing documentation instead of duplicating it:

- [docs/beta-support-and-privacy.md](docs/beta-support-and-privacy.md)
- [docs/accessibility-audit.md](docs/accessibility-audit.md)
- [docs/agent-b-acceptance-matrix.md](docs/agent-b-acceptance-matrix.md)
- [docs/sprint-0-baselines.md](docs/sprint-0-baselines.md)
- [docs/export-integration.md](docs/export-integration.md)
- [docs/product-roadmap-sprints.md](docs/product-roadmap-sprints.md)
