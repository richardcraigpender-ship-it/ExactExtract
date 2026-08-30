export type ProductUpdateKind = 'Feature' | 'Changed' | 'Fixed'

export interface ProductUpdate {
  date: string
  kind: ProductUpdateKind
  title: string
  summary: string
}

export const PRODUCT_UPDATES: readonly ProductUpdate[] = [
  {
    date: '2026-08-30',
    kind: 'Feature',
    title: 'Kept image layouts',
    summary:
      'Place session crops or uploaded PNGs on multi-page kept-entry layouts, then preview and export them.'
  },
  {
    date: '2026-08-30',
    kind: 'Changed',
    title: 'Clearer kept exports',
    summary:
      'Kept text templates and kept PNG layouts now open in separate configuration windows.'
  },
  {
    date: '2026-08-30',
    kind: 'Feature',
    title: 'Flexible layout measurements',
    summary:
      'Use points, millimetres, centimetres, inches, or pixels for layout controls; projects store precise PDF points.'
  },
  {
    date: '2026-08-30',
    kind: 'Changed',
    title: 'Vertical export flow',
    summary:
      'Text and PNG kept exports can fill between Start Y and End Y before continuing on the next page.'
  },
  {
    date: '2026-08-25',
    kind: 'Changed',
    title: 'Windows beta candidate',
    summary: 'The verified installer now uses Electron 41 with a clean production security audit.'
  },
  {
    date: '2026-08-25',
    kind: 'Fixed',
    title: 'Faster large reviews',
    summary: 'Long review queues now render only the visible entries plus a small overscan buffer.'
  },
  {
    date: '2026-08-25',
    kind: 'Feature',
    title: 'Native source recovery',
    summary: 'Relink one or many missing PDFs and keep the repaired paths after restart.'
  },
  {
    date: '2026-08-25',
    kind: 'Fixed',
    title: 'Reliable Retry Save',
    summary:
      'Save failures show actionable details and preserve pending changes for a successful retry.'
  },
  {
    date: '2026-08-25',
    kind: 'Changed',
    title: 'Safer app closing',
    summary: 'Unsaved work now opens a native choice to keep working or close without saving.'
  },
  {
    date: '2026-08-25',
    kind: 'Fixed',
    title: 'Exact statement reconciliation',
    summary:
      'Revolut statements handle omitted zero columns without treating card references as money.'
  },
  {
    date: '2026-08-25',
    kind: 'Changed',
    title: 'Accessible status updates',
    summary:
      'Autosave and extraction progress expose atomic status messages and errors remain alerts.'
  },
  {
    date: '2026-08-25',
    kind: 'Fixed',
    title: 'Responsive at every scale',
    summary: 'The workspace remains usable at narrow widths and 100%, 150%, and 200% scaling.'
  },
  {
    date: '2026-08-24',
    kind: 'Changed',
    title: 'Offline OCR verified',
    summary:
      'English, Spanish, French, and German OCR assets initialize without a network download.'
  },
  {
    date: '2026-08-24',
    kind: 'Fixed',
    title: 'OCR resource cleanup',
    summary:
      'PDF documents, raster canvases, and OCR workers are released after success or failure.'
  },
  {
    date: '2026-08-24',
    kind: 'Feature',
    title: 'Scanned PDF workflows',
    summary: 'Scanned, mixed, and rotated PDF fixtures produce source-traceable OCR entries.'
  },
  {
    date: '2026-08-24',
    kind: 'Fixed',
    title: 'Project persistence',
    summary: 'Analysis, layout, page removal, review state, and recent projects survive reopen.'
  },
  {
    date: '2026-08-24',
    kind: 'Changed',
    title: 'Safer PDF limits',
    summary: 'Actionable checks cover file size, page count, document count, and malformed PDFs.'
  },
  {
    date: '2026-08-22',
    kind: 'Feature',
    title: 'Template-driven exports',
    summary: 'Configure page templates, columns, backgrounds, fonts, and financial summaries.'
  },
  {
    date: '2026-08-22',
    kind: 'Feature',
    title: 'Installed system fonts',
    summary: 'Use locally installed fonts in kept-entry PDF layouts with a safe fallback.'
  },
  {
    date: '2026-08-21',
    kind: 'Feature',
    title: 'Review intelligence',
    summary: 'Edit extraction boxes, map statement columns, and reconcile balances.'
  },
  {
    date: '2026-08-21',
    kind: 'Feature',
    title: 'Final PDF preview',
    summary: 'Inspect the exact generated PDF before saving any export format.'
  },
  {
    date: '2026-08-21',
    kind: 'Changed',
    title: 'Kept-layout export',
    summary: 'Source row glyphs are preserved without overlapping replacement text.'
  },
  {
    date: '2026-08-20',
    kind: 'Fixed',
    title: 'Stable page navigation',
    summary: 'PDF pages retain a stable frame while moving between source pages.'
  },
  {
    date: '2026-08-18',
    kind: 'Feature',
    title: 'Project recovery',
    summary: 'Recent projects can locate missing source PDFs and retry failed saves.'
  },
  {
    date: '2026-08-17',
    kind: 'Feature',
    title: 'Local project workspace',
    summary:
      'Create, reopen, and autosave projects without sending project data to a cloud service.'
  },
  {
    date: '2026-08-17',
    kind: 'Feature',
    title: 'Multi-PDF import',
    summary:
      'Bring multiple source documents into one project and navigate them from the source rail.'
  },
  {
    date: '2026-08-16',
    kind: 'Feature',
    title: 'Flexible extraction modes',
    summary: 'Choose Fast, Balanced, Maximum, or Custom extraction after document preflight.'
  },
  {
    date: '2026-08-16',
    kind: 'Feature',
    title: 'Source-linked review',
    summary:
      'Review extracted entries beside their PDF and trace each result back to its source page.'
  },
  {
    date: '2026-08-15',
    kind: 'Feature',
    title: 'Keep, Maybe, or Exclude',
    summary:
      'Classify individual entries, edit extracted text, filter results, and apply bulk decisions.'
  },
  {
    date: '2026-08-15',
    kind: 'Feature',
    title: 'Kept-only analysis',
    summary:
      'Calculate metrics and validation results from the entries selected for the final output.'
  },
  {
    date: '2026-08-14',
    kind: 'Feature',
    title: 'Core export formats',
    summary: 'Export reviewed results as PDF, CSV, JSON, or individual kept-entry images.'
  },
  {
    date: '2026-08-13',
    kind: 'Feature',
    title: 'Page removal controls',
    summary: 'Remove unwanted PDF pages with confirmation and keep the reduced source for export.'
  },
  {
    date: '2026-08-13',
    kind: 'Feature',
    title: 'Page removal undo and redo',
    summary: 'Reverse or reapply page-removal decisions without disturbing general review history.'
  },
  {
    date: '2026-08-13',
    kind: 'Feature',
    title: 'Financial column mapping',
    summary: 'Assign detected statement columns to money in, money out, balance, or ignore.'
  },
  {
    date: '2026-08-13',
    kind: 'Feature',
    title: 'Payee-linked entries',
    summary: 'Preserve recognized business descriptions as payees with source-entry provenance.'
  },
  {
    date: '2026-08-12',
    kind: 'Feature',
    title: 'Monthly financial summaries',
    summary: 'Compare money in, money out, and net movement by month and across the document.'
  },
  {
    date: '2026-08-12',
    kind: 'Feature',
    title: 'Balance validation',
    summary: 'Show opening, closing, calculated closing, and reconciliation difference together.'
  },
  {
    date: '2026-08-12',
    kind: 'Changed',
    title: 'Traceable analysis issues',
    summary: 'Analysis results retain contributor entry IDs so findings lead back to Review.'
  },
  {
    date: '2026-08-12',
    kind: 'Changed',
    title: 'Private export snapshots',
    summary: 'Export snapshots omit local source paths while preserving page and region references.'
  },
  {
    date: '2026-08-11',
    kind: 'Fixed',
    title: 'Atomic project saves',
    summary: 'Project writes use replace-safe storage to avoid leaving a partially written project.'
  },
  {
    date: '2026-08-11',
    kind: 'Changed',
    title: 'Independent recent projects',
    summary: 'Removing a recent-project shortcut leaves saved projects and global payees untouched.'
  },
  {
    date: '2026-08-11',
    kind: 'Changed',
    title: 'Deterministic export data',
    summary: 'Preview and export snapshots use stable, schema-versioned data for repeatable output.'
  },
  {
    date: '2026-08-11',
    kind: 'Fixed',
    title: 'Extraction cancellation cleanup',
    summary:
      'Cancelled extraction preserves completed results and releases active PDF and OCR work.'
  },
  {
    date: '2026-08-10',
    kind: 'Changed',
    title: 'Encrypted PDF guidance',
    summary:
      'Password-protected documents now return clear unlock guidance instead of a generic error.'
  },
  {
    date: '2026-08-10',
    kind: 'Changed',
    title: 'Malformed PDF guidance',
    summary: 'Damaged or truncated documents now explain that a valid replacement is required.'
  },
  {
    date: '2026-08-10',
    kind: 'Fixed',
    title: 'Duplicate import protection',
    summary: 'Repeated source paths are ignored before they can create duplicate project documents.'
  },
  {
    date: '2026-08-10',
    kind: 'Changed',
    title: 'Batch import guardrails',
    summary:
      'Import accepts up to 50 unique PDFs and rejects the next file before changing the project.'
  },
  {
    date: '2026-08-09',
    kind: 'Feature',
    title: 'Keyboard pane resizing',
    summary: 'Resize the PDF and Review panes with Arrow, Home, and End keys.'
  },
  {
    date: '2026-08-09',
    kind: 'Changed',
    title: 'Accessible review decisions',
    summary: 'Keep, Maybe, and Exclude controls expose their current pressed state.'
  },
  {
    date: '2026-08-09',
    kind: 'Fixed',
    title: 'Dialog keyboard containment',
    summary: 'Modal tools trap Tab, close with Escape, and restore focus to the opening control.'
  },
  {
    date: '2026-08-09',
    kind: 'Changed',
    title: 'Reduced-motion support',
    summary:
      'Interface animation and transition durations are minimized when reduced motion is set.'
  },
  {
    date: '2026-08-08',
    kind: 'Feature',
    title: 'Light and dark themes',
    summary: 'Switch between accessible light and dark workspace themes.'
  },
  {
    date: '2026-08-08',
    kind: 'Fixed',
    title: 'Readable semantic colors',
    summary: 'Core text and status color pairs meet WCAG AA contrast in both themes.'
  },
  {
    date: '2026-08-07',
    kind: 'Changed',
    title: 'Local-first privacy',
    summary: 'PDF processing and project storage stay on the device without requiring an account.'
  }
]
