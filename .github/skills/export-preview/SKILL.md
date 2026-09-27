---
name: export-preview
description: 'Use when changing or debugging ExactExtract export previews, formatted text statements, PNG snippet boards, template layout, fonts, backgrounds, references, page numbers, dividers, or PDF output parity.'
argument-hint: 'Describe the export setting or preview mismatch'
---
# Export Preview Workflow

## When to Use

- A live text or PNG preview does not match the final export.
- A template setting changes fonts, positions, backgrounds, references, page numbers, dividers, clipping, or row spacing.
- The export panel or canvas studio is being simplified or reorganized.

## Procedure

1. Identify the source of truth for the setting:
   - Shared template contract: `src/shared/keptExportTemplate.ts`
   - Draft/editor state: `src/renderer/src/components/keptExportTemplateDraft.ts` and `KeptExportTemplateEditor.tsx`
   - Layout plan: `src/export/keptExportLayout.ts`
   - PDF rendering: `src/export/keptExportTemplatePdf.ts`
   - Renderer preview: `src/renderer/src/components/ExportCanvas.tsx` and `KeptCanvasStudioBody.tsx`
2. Trace the setting through the full path before editing. Do not add a preview-only calculation when the final PDF uses a different layout source.
3. Preserve source evidence: clipping may change rendered output only; never mutate stored payee, description, reference, or source-region data to fit a page.
4. Keep payee/description and reference lines distinct. Check configurable payee-to-reference gaps, post-entry spacing, divider clearance, and long-text behavior together.
5. Add focused tests in:
   - `src/export/keptExportLayout.test.ts` for geometry and placement positions
   - `src/export/keptExportTemplatePdf.test.ts` for generated PDF text/output
   - `src/renderer/src/components/ExportCanvas.test.tsx` or the relevant editor test for preview markup and accessibility
6. Run the focused tests, then `npm run typecheck`. For release-impacting changes, run `npm run build` and the relevant Windows/OCR package gates.
7. If output still differs, compare the generated render plan and final PDF path rather than repeatedly adjusting CSS or preview constants.

## Acceptance Checklist

- Template defaults and legacy templates remain valid.
- Editor controls persist through draft conversion and reopen.
- Preview and final PDF use the same values and geometry.
- Fonts, backgrounds, references, page numbers, dividers, clipping, and entry spacing are covered where affected.
- Keyboard labels and focus states remain intact.
