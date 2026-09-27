# Two-agent product delivery plan

## Purpose

This plan consolidates the original product roadmap, the later quality-of-life suggestions, and the work already completed in the current workspace. It uses two implementation agents:

- **Agent A - Domain and data contracts:** shared contracts, persistence, extraction/review logic, merchant rules, export geometry, and IPC ownership.
- **Agent B - Product workflow and acceptance:** renderer workflows, accessibility, responsive behavior, integration tests, packaging, and release evidence.

The agents must agree on contracts before parallel work. Agent B must not recreate domain logic in the renderer, and Agent A must not make broad renderer changes in `App.tsx`.

## Already implemented foundations

These are existing foundations, not new sprint scope:

- Sprint 0 performance benchmark and representative fixture manifest in [docs/sprint-0-baselines.md](sprint-0-baselines.md) and [test-data/manifests/sprint-0-fixtures.json](../test-data/manifests/sprint-0-fixtures.json).
- Extraction reports and report attention-page calculations.
- Shared review queue reason codes, priority ordering, confidence threshold, and built-in review preset definitions.
- Direct Review queue navigation, `Review next`, queue reason filtering, and accessible report/source-entry navigation.
- MerchantStore, aliases, canonical names, categories, recurring fields, provenance, and merchant-rule preview/application contracts.
- Export presets, reference-safe layout, configurable payee/reference gap, fixed 5pt post-entry spacing, and render-plan/PDF tests.
- Portable project bundle creation/import, explicit source inclusion, manifest hashes, corruption detection, preload IPC, and main-process handlers.
- ExactExtract Windows packaging, packaged OCR verification, lifecycle evidence, and focused accessibility acceptance.

Do not rebuild these features. Extend their existing contracts and add missing integration, persistence, UI, and release evidence only.

## Global ownership boundaries

### Agent A owns

- `src/shared/` contracts and migrations.
- `src/review/`, `src/analysis/`, `src/extraction/`, and `src/ocr/` domain logic.
- `src/main/` persistence, bundle, export-save, recovery, and merchant-rule behavior.
- `src/export/` shared geometry, font metrics, background resolution, and PDF output.
- Contract tests and deterministic fixtures for those modules.

### Agent B owns

- `src/renderer/src/components/`, hooks, styles, and interaction state.
- Preload declarations/implementation when an IPC contract is approved by Agent A.
- Accessibility, keyboard behavior, responsive layout, renderer integration tests, and installed acceptance evidence.
- Release documentation updates based on measured evidence.

### Shared surfaces

- `src/renderer/src/App.tsx`, `src/preload/index.ts`, and `src/preload/index.d.ts` require an explicit handoff before edits.
- One agent owns each contract change; the other consumes it.
- No concurrent edits to the same shared file.
- Every handoff records changed files, contract changes, validation commands, and remaining risks in the coordination docs.

## Global non-regression rules

- Preserve local-only processing and offline OCR.
- Preserve raw extracted text, `SourceRegion` traceability, payees, references, and audit history.
- Never use fuzzy automatic source relinking.
- Render-only clipping is allowed; stored source text must not be truncated.
- Test live state separately from save/reload state.
- Test fresh extraction and reopened legacy projects for schema-affecting behavior.
- Run the narrowest focused test first, then `npm run typecheck`.
- For release work, run `npm run build` before OCR/package/lifecycle gates.
- Use fresh terminal invocations and captured logs for long commands; never infer status from stale terminal output.
- Do not commit generated `out/`, `dist-*`, OCR assets, installer files, profiles, or temporary logs.

# Sprint 0 - Contract and risk lock

**Goal:** Establish the contracts and baselines that prevent cross-agent drift.

**Length:** 2-3 working days.

### Agent A - Domain contract lock

- Audit the current `src/shared/merchants.ts`, `src/shared/keptExportTemplate.ts`, project schema, review queue, extraction report, and bundle manifest contracts.
- Add or update schema migration entries for any new persisted fields.
- Define ownership for:
  - Review preset persistence
  - Merchant rule decisions and undo records
  - Export preset identifiers
  - Bundle privacy options
  - Diagnostics metadata
- Confirm the active `MerchantStore` path; do not extend legacy `PayeeStore` for new features.
- Define conflict and precedence rules for merchant decisions versus explicit user decisions.

### Agent B - Acceptance and baseline lock

- Extend the Sprint 0 benchmark with targets for:
  - 2,000-page project open/reopen
  - 2,000-entry filter and Review next navigation
  - Export render-plan generation
  - OCR progress/cancellation
  - Large bundle creation/import
- Define renderer acceptance fixtures for:
  - 520px narrow desktop width
  - 100%, 150%, and 200% scale
  - light/dark themes
  - reduced motion
  - keyboard focus and tab order
- Create a release evidence template separating executable checks from manual Narrator and clean-account/VM boundaries.

### Scope, privacy, and security

- No user-facing feature work starts until persisted field ownership and migration impact are written down.
- Bundle tests must distinguish copied source PDFs from references and must never silently include OCR caches or temporary files.
- Diagnostics must omit PDF contents, payee data, source paths, and file contents by default.

### Testing and validation

- `npm run typecheck`
- Existing focused review, merchant, export, persistence, OCR, and bundle tests.
- `npm run benchmark:sprint0`
- `git diff --check`

### Sprint 0 exit criteria

- Contract owners and file boundaries are agreed.
- Migration map and fixture matrix are documented.
- Baseline targets are captured.
- No unresolved contract ambiguity blocks Sprint 1.

# Sprint 1 - Review completion workflow

**Goal:** Make review work fast, explainable, and safe for large documents.

**Length:** 4-5 working days.

### Agent A - Review data and persistence

- Persist user-created review presets with project/global scope.
- Keep built-in preset IDs deterministic and non-destructive.
- Ensure queue state updates immediately after Keep, Maybe, Exclude, merge, split, metadata edits, and merchant-rule decisions.
- Add a stable review-progress model:
  - total visible entries
  - reviewed entries
  - attention entries remaining
  - current page scope
- Add clear-filter state and queryable queue reason contracts.

### Agent B - Review workflow UI

- Keep Keep, Maybe, Exclude, and Plus permanently visible.
- Move Merge and References into an overflow menu at narrow widths only.
- Preserve direct Review queue access beside Source, Analysis, and Export.
- Add saved preset selection, clear-filter action, progress indicator, and accessible queue explanations.
- Ensure `Review next` chooses an item within the current page/document scope before falling back to the wider queue.
- Keep “all standard entries” visually distinct from attention-queue entries.

### Scope, privacy, and security

- Bulk actions require affected-entry counts and conflict warnings before applying.
- Existing explicit decisions must not be overwritten by a preset or queue action without confirmation.
- Review progress must not expose source paths or document contents outside the local app.

### Testing and validation

- Unit tests for queue scope, priority, current-page selection, filter reset, and live-state updates.
- Renderer tests for narrow desktop widths, overflow-menu visibility, focus order, accessible labels, and status announcements.
- Behavioral tests for each status button updating entry state and audit trail.
- Tests that Plus opens metadata editing for the selected entry.
- Save/reload tests for status changes, metadata edits, presets, and queue state.
- Undo/redo tests for status and metadata changes.
- `npm run benchmark:sprint0` comparison for filtering and navigation.

### Sprint 1 exit criteria

- A reviewer can complete a current-page queue without losing scope.
- The standard list and attention queue cannot be confused.
- All status, metadata, preset, save/reload, and undo/redo tests pass.
- Narrow-width accessibility acceptance passes before moving to Sprint 2.

# Sprint 2 - Merchant intelligence and diagnostics

**Goal:** Make repeated merchant cleanup safe, reversible, and easy to understand.

**Length:** 4-5 working days.

### Agent A - Merchant rules and audit

- Extend existing `MerchantStore` only.
- Add persisted default-review-rule fields through the project/library migration path.
- Support current-project and future-project scopes.
- Preview before applying:
  - matching entries
  - affected count
  - conflict count
  - current status distribution
- Require explicit confirmation for conflicts.
- Persist versioned `MerchantRuleDecision` records with applied entry IDs and reversible state.
- Add full undo for applied rules.
- Keep fuzzy matching opt-in; normalized payee/alias matching must remain inspectable.

### Agent B - Merchant review UI and diagnostics

- Show original text, normalized payee, matching alias/rule, source page, and applied decision together.
- Add approve, reject, edit, preview, apply, and undo actions.
- Add a sanitized “Copy diagnostic details” action for support.
- Include app version, OS, extraction mode, OCR languages, error codes, and safe counts only.
- Add duplicate-source/import messaging when a PDF is already present or has the same content hash.

### Scope, privacy, and security

- Merchant rules must never mutate `rawText` or remove source regions.
- Diagnostics must never copy PDF bytes, payee lists, source paths, or reference contents by default.
- Conflict behavior must be conservative: explicit user decisions win unless the user opts into override.

### Testing and validation

- Shared tests for alias matching, conflicts, scope, versioning, undo, and audit records.
- UI tests for preview counts, conflict warnings, source evidence, and accessible controls.
- Save/reload tests for rule persistence and reversibility.
- Fresh/reopened parser fixtures for `Payment from`, split rows, references, OCR, Revolut, and stale payees.
- MerchantStore, merchant-rule, payee, extraction, reconciliation, and export regression suites.
- Targeted lint and `npm run typecheck` before broad tests.

### Sprint 2 exit criteria

- No duplicate merchant/rule store exists.
- Every automatic decision is previewed, scoped, auditable, and reversible.
- Support diagnostics are safe by construction.
- Existing merchant provenance and forecast behavior remain intact.

# Sprint 3 - Export parity and reliable output

**Goal:** Make export presets and previews predictable across text, PDF, and image workflows.

**Length:** 5-7 working days.

### Agent A - Shared geometry and output contracts

- Create one shared preview geometry helper for:
  - page dimensions
  - point-to-pixel conversion
  - text line boxes
  - reference offsets
  - alignment calculations
  - background geometry
- Replace duplicated average-character-width wrapping with actual font metrics where available.
- Define explicit export preset contracts:
  - Clean statement
  - Source-faithful evidence
  - Image archive
- Validate background refs before preview and resolve the same image bytes for preview and export.
- Keep the current configurable payee/reference gap and fixed 5pt post-entry spacing as contract values.

### Agent B - Preview/editor and save workflow

- Make the live preview consume the shared render plan used by final PDF output.
- Verify standard fonts and system fonts separately.
- Add PDF-vs-preview fixture comparisons for headers, references, centered columns, long text, backgrounds, page numbers, dividers, and clipping.
- Add export destination preview, overwrite confirmation, cancellation, atomic save, retry, and stale-snapshot protection.
- Keep advanced controls available without forcing them into the primary export path.

### Scope, privacy, and security

- Never embed source paths in exported snapshots unless explicitly required by the selected preset.
- Source-faithful output may preserve references and traceability but must not invent text.
- Backgrounds may be copied into managed local storage; validate refs and reject missing/corrupt data without silently substituting unrelated files.

### Testing and validation

- Geometry unit tests for every shared helper.
- PDF-vs-preview fixture tests for standard/system fonts.
- Background tests for PNG, JPEG, WebP, missing refs, opacity, and flipped Y coordinates.
- Long-description, reference gap, 5pt whitespace, divider, alignment, and page-flow tests.
- Focused export tests first, then:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Run Windows/OCR gates only after the general build is green.

### Sprint 3 exit criteria

- Preview and final output use the same geometry/data path.
- All documented presets have tested field, reference, background, crop, font, and long-text behavior.
- Export failure/cancel/retry paths are recoverable.
- No regression in existing PDF, CSV, JSON, PNG, or kept-template exports.

# Sprint 4 - Portable projects and recovery quality

**Goal:** Make project movement and recovery understandable without weakening local-first privacy.

**Length:** 4-5 working days.

### Agent A - Bundle format and persistence

- Finalize the bundle manifest with project schema version, source hashes, included assets, created time, and app version.
- Define whether PDFs, OCR outputs, images, caches, and derived assets are included.
- Add optional encryption/compression only after the unencrypted contract is stable.
- Handle large bundles with progress, cancellation, temporary storage, and cleanup.
- Reject corrupted, incomplete, mismatched-version, duplicate-source, and interrupted-copy bundles.

### Agent B - Launch and recovery UX

- Keep Resume latest and Project bundle actions aligned on the launch page.
- Add visible package/import progress, cancellation, source inclusion warning, and verification results.
- Show matched, missing, skipped, and ambiguous relinking outcomes.
- Preserve explicit confirmation for ambiguous source matching.
- Add pin/favorite recent projects and a clear project rename action if they do not conflict with the current launch layout.

### Scope, privacy, and security

- Source inclusion must be explicit before bundle creation.
- Sensitive-data warnings appear before files are copied.
- Imported paths and hashes must be verified before the project becomes active.
- Uninstall continues to retain user project/payee data by policy.

### Testing and validation

- Bundle create/import round-trip tests.
- Hash, corruption, interruption, large-bundle, and missing-source tests.
- Renderer tests for progress, cancellation, warning text, focus, and recovery statuses.
- Packaged Windows lifecycle tests after `npm run build` succeeds.
- Verify retained user data after uninstall and same-version reinstall.

### Sprint 4 exit criteria

- A project moves between machines without losing source traceability.
- Privacy choices are explicit and testable.
- Recovery remains deterministic and never fuzzy.
- Large operations remain cancellable and do not freeze the main window.

# Sprint 5 - Reliability and release hardening

**Goal:** Close remaining quality-of-life and release-risk gaps without adding scope to the core workflow.

**Length:** 3-5 working days.

### Agent A - Reliability and diagnostics

- Add per-page OCR retry without rerunning successful pages.
- Add import duplicate detection by normalized path and content hash.
- Add reconciliation anomaly drill-down for wrong mappings, missing rows, duplicates, unmapped values, and direction conflicts.
- Add recovery checkpoints for large extraction operations where the existing job model supports them.

### Agent B - Acceptance and support workflow

- Add a sanitized support bundle export with no PDF contents, source paths, payee lists, or secrets.
- Add a release-health panel showing app version, OCR asset versions, last successful save, storage policy, and signing status.
- Add clean-install smoke acceptance:
  - install
  - launch
  - create project
  - import fixture
  - save
  - close
  - reopen
  - uninstall
- Complete keyboard-only and human-audible Narrator acceptance where the environment permits it.

### Scope, privacy, and security

- Support bundles must be reviewed against an allowlist of fields.
- OCR retry must preserve prior successful results and source regions.
- No release-health panel should expose source paths or document contents by default.
- Keep unsigned-artifact warnings and SHA-256 verification explicit.

### Testing and validation

- Focused OCR retry, duplicate import, reconciliation, diagnostics, and release-health tests.
- Accessibility tests for support/release dialogs, focus restoration, status announcements, and reduced motion.
- Full suite and typecheck.
- `npm run lint`
- `npm run build`
- OCR offline/fixture/package gates.
- Windows beta packaging and lifecycle acceptance only after all general gates are green.

### Sprint 5 exit criteria

- Remaining release-risk gaps are either verified or explicitly documented as manual boundaries.
- Support diagnostics are privacy-safe.
- Clean-install smoke flow is repeatable.
- No unresolved blocker remains in typecheck, build, focused acceptance, or packaging gates.

## Handoff and blocker protocol

At the start of each sprint:

- Agree on owner files, TypeScript contracts, IPC shape, schema impact, fixture inputs, and acceptance commands.
- Create a short handoff entry in `Agent-chatter.md` before parallel edits.
- Record whether the work is code, test, documentation, or manual acceptance.

During implementation:

- Stop and hand off if a needed contract is missing rather than inventing a duplicate type.
- Do not continue after a typecheck or focused test failure without recording the exact blocker and file.
- Do not interpret stale terminal output as current evidence; rerun the command cleanly.
- Keep unrelated failures separate from the active sprint.

At sprint completion:

- Report changed files, contract/migration changes, focused tests, typecheck, lint, build, and remaining manual gaps.
- Run the next wider gate only after the narrow gate is green.
- Update [docs/release-readiness.md](release-readiness.md) only with current evidence.

## Final release gate

The two-agent plan is complete only when:

- Focused tests for the changed slice pass.
- `npm run lint` has no severity-2 errors.
- `npm run typecheck` passes.
- `npm test` passes with no failures, cancellations, skips, or todos.
- `npm run build` passes.
- OCR offline, fixture, and packaged checks pass when extraction/OCR changed.
- Windows packaging and lifecycle checks pass when packaging or native behavior changed.
- Manual Narrator, clean-account/VM, and installed interactive workflow gaps are explicitly classified rather than silently assumed complete.
