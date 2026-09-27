---
description: "Use when building or modifying React renderer components, Electron UI, accessibility behavior, responsive layouts, export previews, or frontend tests."
name: "ExactExtract Frontend"
applyTo: "src/renderer/src/**/*.{ts,tsx,css}"
---
# Frontend Guidelines

- Keep `src/renderer/src/App.tsx` as composition and event wiring; put domain behavior in the owning component, hook, or domain module.
- Before changing `App.tsx`, inspect the current state and keep shared contracts/IPC changes in their owning modules; do not use the composition file as a second domain layer.
- Preserve the typed `window.studio` preload boundary. Renderer code must not access Node filesystem or Electron APIs directly.
- Follow existing React 19 patterns and local component/test conventions. Prefer focused changes over broad UI rewrites.
- Treat source text, payees, references, regions, and review decisions as evidence. Render-only clipping is acceptable for export layout; never mutate stored source values to fit a preview.
- Keep payee/description and reference lines separate. Export preview and final PDF layout must reserve explicit space for references and entry spacing.
- For every export setting that changes layout, verify both the live preview and final PDF path. Prefer one shared render-plan/data path over preview-only calculations, and add paired preview/PDF regression coverage.
- Every interactive control needs a useful accessible name, visible keyboard focus, and correct pressed/selected/expanded state. Dialogs must restore focus and support Escape where the surrounding component does.
- Check narrow-window behavior, light/dark themes, reduced motion, and text overflow when changing shared layout or controls.
- Add a focused renderer test for new states, accessibility semantics, and user-visible behavior. Run the narrow test first, then `npm run typecheck`.
- Link to [docs/accessibility-audit.md](../../docs/accessibility-audit.md) and [docs/export-integration.md](../../docs/export-integration.md) for detailed acceptance history.
