# Sprint 0 shared contracts — Agent A

Owner: Agent A. These are the stable contracts other agents should build against for Sprints 1-2; none of this wires up UI or persistence, which are Agent B/C and later-sprint responsibilities.

## Review issue codes and severity

`src/review/heuristics.ts`

- `ReviewIssueCode`: `'duplicate-entry' | 'broken-row-across-pages'` (unchanged).
- `ReviewIssueSeverity` (new): `'info' | 'warning' | 'critical'`. Existing detectors still emit `'warning'`; the wider type lets later detectors escalate without a breaking change.

## Queue priority rules and confidence threshold

`src/review/queue.ts` (pre-existing, unchanged by this sprint) — `buildReviewQueue`, `ReviewQueueReasonCode`, per-reason `priority`, and `DEFAULT_REVIEW_QUEUE_CONFIDENCE_THRESHOLD` (0.7) are already the shared contract for Sprint 1B.

## Extraction report contract

`src/review/extractionReport.ts` — `buildExtractionReport(preflight, entries, options)` builds an `ExtractionDocumentReport` purely from already-persisted contracts (`DocumentPreflightResult`, `ProjectEntry`, `ExtractionSettings`, `ReviewIssue`). It does not read the audit trail itself — callers pass `mergedEntryIds` if they want merged-row counts, since audit-trail parsing is Sprint 1A's wiring concern.

Confidence buckets use `EXTRACTION_REPORT_CONFIDENCE_THRESHOLDS` (`low: 0.5`, `high: 0.85`), a separate scale from the queue's single 0.7 cutoff — the report needs a 3-way distribution, the queue needs a single flag.

## Saved presets contract

`src/review/presets.ts` — `ReviewFilterPreset`/`ReviewFilterPresetFilters` reuse `ReviewQueueReasonCode` directly, so a preset and the guided queue can never disagree about what "OCR only" or "Possible duplicates" means. `createBuiltInReviewPresets(scope, createdAt)` returns the five named presets from Sprint 1C with deterministic `built-in:*` ids (stable across reopen, no need to persist them).

## Rule decision contract

`src/shared/merchants.ts` — `MerchantRuleDecision` models one applied, reversible, auditable rule action (`MerchantRuleAction`) tied to the entries it was applied to. This is the shape Sprint 2 Agent A should persist and Agent C should build approve/reject/edit UI against; no rule engine exists yet, only the contract.

## Ownership note

Sprint 2 work should extend `MerchantStore`/`merchants.ts`. The legacy `payeeLibraryStore.ts`/`PayeeStore` is not wired into any UI and should not be extended for new payee/merchant features.
