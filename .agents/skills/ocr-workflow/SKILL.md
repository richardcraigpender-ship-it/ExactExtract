---
name: ocr-workflow
description: "Use when changing or validating offline PDF extraction, OCR orchestration, OCR fixtures, language assets, cancellation cleanup, or source-region traceability."
---

# Offline OCR Workflow

Use this skill for OCR or extraction changes that affect the production pipeline, bundled language data, or traceability.

## Workflow

1. Read the owning code under `src/ocr/` and `src/extraction/`, then inspect the nearest focused tests.
2. Preserve offline behavior: OCR assets are bundled for English, Spanish, French, and German; do not add a network dependency to the runtime path.
3. Preserve cancellation and cleanup for PDF documents, raster canvases, and Tesseract workers on success, failure, and cancellation.
4. Preserve raw extracted text and `SourceRegion` data, including PDF-point bounding boxes, through parser/OCR merge, review, persistence, and export.
5. Run the narrowest focused test first, then typecheck. For pipeline or asset changes, run:

```powershell
npm run verify:ocr-offline
npm run verify:ocr-fixtures
npm run verify:ocr-workflow
```

`predev`, `prestart`, and `prebuild` prepare OCR assets automatically. Use `npm run prepare:ocr-assets` explicitly when inspecting or regenerating the bundled assets.

## Acceptance Boundaries

- The workflow verifier covers scanned, mixed, and rotated representative fixtures and requires traceable OCR entries.
- Interactive Electron OCR acceptance remains a manual boundary; do not claim it from fixture or package checks alone.
- Link to [OCR and beta support](../../../docs/beta-support-and-privacy.md), [shared contracts](../../../docs/sprint-0-shared-contracts.md), and [release readiness](../../../docs/release-readiness.md) for policy and release context.
