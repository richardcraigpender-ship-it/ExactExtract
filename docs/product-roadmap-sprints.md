# Product roadmap sprints

Planning basis: current extraction, OCR, review, analysis, payee, export, recovery, and Windows beta capabilities.

## Sprint 0 - Shared contracts and baselines

**Goal:** Establish common definitions and evidence before multiple agents build dependent features.

**Length:** Short foundation sprint. Split across Agents A, B, and C.

### Agent A - Shared review contracts

- Define stable review issue codes and severity levels.
- Define queue priority rules and confidence thresholds.
- Define the data contract for extraction reports, review queue items, saved presets, and rule decisions.

### Agent B - Persistence and migration contracts

- Define project schema migration rules for review, rule, bundle, and audit fields.
- Audit fields that may be correct only after save/reload and ensure they are correct in the live session too.
- Document ownership of renderer state, project persistence, IPC, and the active `MerchantStore` versus legacy `payeeLibraryStore.ts` paths.

### Agent C - Fixtures and performance baselines

- Add representative digital, scanned, OCR, multi-line, duplicate, reference, and large-project fixtures.
- Record baselines for opening, filtering, review navigation, OCR cancellation, and export preview.
- Define targets for 2,000-page documents and large entry counts.

### Sprint 0 acceptance

- Agents agree on shared TypeScript/data contracts before parallel implementation begins.
- Issue codes, priorities, thresholds, migration rules, fixtures, and performance targets are documented.
- Baseline measurements exist for filtering, project opening, OCR progress/cancellation, and export preview responsiveness.

## Sprint 1A - Extraction report and warning links

**Goal:** Make extraction quality and unresolved work visible before building the guided queue.

**Length:** Short sprint. Report first so the guided queue can consume stable warning and confidence data.

### Agent A - Extraction report

- Add a per-document extraction summary showing pages processed, digital/scanned/mixed page counts, OCR pages and languages, confidence distribution, merged/excluded rows, and pages requiring attention.
- Link every summary item to the relevant review filter or source page.

### Agent B - Report data and persistence

- Expose report data through the agreed project/renderer contract.
- Verify report values are correct immediately in the live session and after reopen.
- Add report-level performance checks for large documents.

### Agent C - Report acceptance and accessibility

- Add focused report tests, source-page navigation tests, keyboard checks, and screen-reader labels.
- Confirm opening a project does not eagerly load every source image just to render the report.

### Sprint 1A acceptance

- Report totals match extraction/project state both before and after save/reload.
- Report links open the correct review filter and source page.
- Large-project report rendering remains within the Sprint 0 performance target.

## Sprint 1B - Guided review queue

**Goal:** Turn existing warnings and confidence data into a clear completion workflow.

**Length:** Medium sprint. Split across Agents A, B, and C.

### Agent A - Guided queue

- Add a `Review next` queue for low-confidence entries, OCR-derived entries, unresolved `Maybe` entries, duplicate candidates, unmapped financial rows, and review warnings.
- Add queue counts and a direct action to move to the next item.
- Preserve existing Keep, Maybe, Exclude decisions and bulk actions.

### Agent B - Queue computation and state

- Implement Sprint 0 priority rules and shared issue codes.
- Keep queue state correct during live edits, not only after persistence or reload.
- Add performance tests for filtering and navigation with large entry counts.

### Agent C - Queue interaction and accessibility

- Add explanation text for why each item needs attention.
- Verify keyboard focus, screen-reader labels, focus restoration, and narrow-window behavior.

### Sprint 1B acceptance

- A user can reach every unresolved/high-risk row through one guided queue.
- Priority and confidence behavior matches the shared contract.
- Queue state updates immediately after Keep, Maybe, Exclude, merge, split, and rule decisions.
- Filtering and next-item navigation meet the Sprint 0 performance target.

## Sprint 1C - Saved presets and refinement

**Goal:** Make repeat review workflows fast without hiding advanced filtering.

**Length:** Short sprint. Split across Agents A, B, and C.

### Agent A - Presets

- Add saved presets for Needs attention, OCR only, Low confidence, Possible duplicates, and Unmapped financial rows.

### Agent B - Persistence

- Persist preset definitions with schema migration support.
- Keep presets project-scoped unless explicitly marked reusable.

### Agent C - Accessibility refinement

- Verify preset controls, queue transitions, live statuses, keyboard order, and responsive behavior.

### Sprint 1C acceptance

- Presets restore the same filters and queue results after reopen.
- Presets never bypass Keep/Maybe/Exclude confirmation rules.
- Existing review, filtering, persistence, and accessibility tests remain green.

## Sprint 2 - Payee and transaction intelligence

**Goal:** Reduce repeated cleanup while preserving conservative, source-traceable extraction.

**Length:** Long sprint. Split across Agents A, B, and C.

### Agent A - Payee rules on the existing store

- Extend the existing `MerchantStore` and `MerchantLibraryPanel`; do not rebuild existing alias, canonical-name, category, recurring, and user-override capabilities.
- Implement the genuinely new behavior: optional default review decisions for future matches.
- Retire or explicitly merge the legacy `payeeLibraryStore.ts`/`PayeeStore` path so new rules have one owner.
- Keep fuzzy matching opt-in and show source evidence for every applied rule.
- Add current-project and future-project scopes.
- Require preview, affected-entry count, conflict handling, full undo, rule versioning, and an audit trail before applying a rule.

**Why:** Much of the payee foundation already exists. The new work is safe, reviewable reuse of approved decisions, not a second payee database.

### Agent B - Conservative transaction normalization

- Centralize transaction description normalization for split `Payment from` and `Transfer from` lines, direction labels, continuation lines versus genuine references, and stale persisted payees.
- Preserve raw text and source regions beside every normalized value.
- Add fixtures for bank, Revolut, OCR, and multi-line statement variants.

**Why:** Description quality is central to trust and has already shown regressions when normalization is implemented in only one pipeline stage.

### Agent C - Payee review experience

- Show original text, normalized payee, applied rule, and source region together.
- Add approve, reject, and edit actions for suggested payee changes.
- Make rule application reversible and auditable.

**Why:** Automatic normalization must remain inspectable and reversible for financial data.

### Sprint 2 acceptance

- Repeated payee corrections can be approved once and reused safely without duplicating existing MerchantStore capabilities.
- Every rule application shows scope, affected-entry count, conflicts, preview, and an undo action.
- Rule versions and per-entry audit records survive save/reload.
- `Payment from` rows retain the full person/business description in fresh and reopened projects.
- Reference lines remain separate from payee text.
- Regression coverage includes parser, OCR, persistence, reconciliation, payee library, and export paths.

## Sprint 3 - Export simplification and reference-safe layout

**Goal:** Make the common export path simple while preserving the specialist layout studio.

**Length:** Long sprint. Split across Agents A, B, and C.

### Agent A - Export presets and flow

- Add presets with explicit contracts:
  - **Clean statement:** normalized payee/date/amount fields, references optional, no source crops, standard page numbers.
  - **Source-faithful evidence:** source text/regions and references retained, conservative clipping, provenance visible.
  - **Image archive:** source images/snippets, page references, and no invented financial text.
- Document fields, references, backgrounds, page numbers, source crops, long-description behavior, and supported formats for each preset.
- Consolidate duplicate export entry points behind one Export workflow.
- Keep advanced template, font, divider, background, page-number, and running-balance controls under Advanced.

### Agent B - Reference-safe layout completion

- Treat the existing separate reference line, 3pt gap, alignment, `referenceTextStyle`, and clipping-warning behavior as shipped foundations.
- Complete the remaining scope: dedicated visual and PDF-output tests for clipping, alignment, divider spacing, and long descriptions.
- Ensure rendered payee/description text is snipped only when a reference needs protected space; never alter stored source values.

**Why:** Most of the layout feature already exists. The remaining risk is output verification and edge-case consistency.

### Agent C - Native save and export reliability

- Complete destination selection, overwrite confirmation, cancellation, and atomic-write behavior.
- Add stale-snapshot protection for exports generated while a project changes.
- Improve export progress, failure, retry, and recovery messaging.

### Sprint 3 acceptance

- A normal user can select a documented preset, preview it, and save without entering the advanced studio.
- Each preset has tested field, reference, crop, page-number, background, and long-description behavior.
- Advanced users retain existing layout control.
- Long payees never overwrite or wrap over a reference line.
- Export cancellation, overwrite, failure, retry, and recovery paths are tested.
- Export preview remains within the Sprint 0 responsiveness target.

## Sprint 4 - Portable projects and recovery discoverability

**Goal:** Make projects easier to move and recovery easier to find without weakening data safety.

**Length:** Medium sprint. Split across Agents A, B, and C.

### Agent A - Portable project bundle contract and implementation

- Decide and document the bundle contract before implementation:
  - PDFs are copied into the bundle rather than merely referenced.
  - Define whether OCR output, images, caches, and derived assets are included.
  - Define compression and optional encryption.
  - Define maximum and large-bundle handling.
  - Show sensitive-data warnings before creation.
- Add an explicit opt-in package/import flow with a manifest of source files, hashes, project version, and referenced assets.

### Agent B - Recovery and relinking UX

- Make Recent Projects and missing-source recovery visible from the home screen.
- Add a clear relink summary showing matched, missing, skipped, and ambiguous files.
- Preserve explicit user confirmation for ambiguous source matches.

### Agent C - Bundle validation and lifecycle acceptance

- Add corruption, interrupted-copy, duplicate-source, and version-mismatch tests.
- Verify user-data retention policy during uninstall and reinstall.
- Add packaged Windows acceptance for bundle import/export and relinking.

### Sprint 4 acceptance

- A project can be packaged, moved, imported, and reopened with source traceability intact.
- Missing and ambiguous sources are explicit and recoverable.
- Sensitive-data warnings, inclusion rules, encryption/compression decisions, and retention behavior are documented and tested.
- Large bundles do not freeze the main window and show cancellable progress.

## Sprint 5 - Simplify the product surface

**Goal:** Reduce cognitive load without removing specialist capability.

**Length:** Medium sprint. Split across Agents A, B, and C.

### Agent A - Navigation consolidation

- Keep Source, Review, Analysis, and Export as primary destinations.
- Move Style, Pages, References, Merchants, and other secondary tools under a More/Tools area.
- Keep direct links from warnings and review queue items.

### Agent B - Hide or relocate non-core workflows

- Move forecasting and random scenario generation out of the main extraction workflow into a clearly labelled Planning area.
- Keep the underlying forecasting engine and data intact.
- Remove duplicate export controls from primary panels.

### Agent C - Advanced settings and terminology

- Move manual column mapping, page-number detection, divider geometry, font controls, and background placement into Advanced sections.
- Rename or clarify `Balance snapshot sum` wherever it is currently shown as a total.
- Review empty states, labels, keyboard order, and documentation for the new structure.

### Sprint 5 acceptance

- A first-time user can import, review, analyze, and export without opening Advanced settings.
- Existing specialist workflows remain reachable.
- No data, traceability, recovery, or export capability is removed accidentally.
- Navigation, terminology, and accessibility tests cover the new hierarchy.

## Cross-agent coordination rules

- Before parallel implementation in any sprint, Agents A, B, and C must agree on the TypeScript/data contract, owner module, IPC shape, migration impact, and acceptance commands.
- One agent owns each shared contract; other agents consume it rather than creating parallel types or stores.
- No agent should make broad opportunistic changes in `App.tsx`, shared contracts, or persistence while another agent owns that surface.
- Every sprint must test live in-memory state and save/reload state separately.
- Every large-project feature must include a performance test or measured acceptance against the Sprint 0 baseline.

## Removal and non-goals

These are intentional removals from the default experience, not necessarily code deletion:

- Remove duplicate export entry points from primary screens; retain the underlying export engines.
- Hide expert layout and accounting controls until Advanced mode.
- Move forecasting out of the extraction/review critical path; retain it as a planning feature.
- Do not add fuzzy automatic source relinking.
- Do not silently discard long payee text; only snip the rendered output when a reference needs protected space.
- Do not rebuild MerchantStore capabilities in the legacy PayeeStore path.
- Do not remove local-only processing, offline OCR, source traceability, Keep/Maybe/Exclude decisions, recovery, reconciliation, or accessibility support.

## Recommended sequence

1. Sprint 0 - Shared contracts and baselines
2. Sprint 1A - Extraction report and warning links
3. Sprint 1B - Guided review queue
4. Sprint 1C - Saved presets and refinement
5. Sprint 2 - Payee and transaction intelligence
6. Sprint 3 - Export simplification and reference-safe layout
7. Sprint 4 - Portable projects and recovery discoverability
8. Sprint 5 - Simplify the product surface

Sprint 0 establishes the contracts and baselines that prevent agents from implementing different meanings of “needs attention.” Sprint 1A must precede 1B because the queue consumes the report and warning model; 1C follows once queue behavior is stable. Sprint 2 should extend the existing MerchantStore rather than create a second rules system. Sprint 3 should follow payee normalization so export presets operate on stable descriptions. Sprint 4 requires privacy and file-format decisions before implementation. Sprint 5 remains last so navigation reflects completed workflows rather than anticipating them.
