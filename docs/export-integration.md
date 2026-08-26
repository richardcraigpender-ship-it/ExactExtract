# Export integration

## Ready APIs

The dependency-free export foundation is available from `src/export/index.ts`:

- `buildExportSnapshot(project, options)` creates immutable, deterministic preview/export data.
- `exportProjectCsv(project, options)` emits RFC-style escaped UTF-8 CSV text with CRLF rows.
- `exportProjectJson(project, options)` emits schema-versioned, formatted JSON.
- `ExportPreview` accepts an `ExportSnapshot` through props and does not own project state or IPC.

Exports separate kept and maybe entries. Excluded entries are counted in the summary and are emitted only when `includeExcluded` is true. Source file paths are intentionally omitted; entry regions retain document IDs, page numbers, bounding boxes, and parser/OCR block or table references.

## Native save handoff

Native save is not integrated yet because main/preload and `App.tsx` are protected coordination surfaces. The integration agent should:

1. Add an allow-listed `window.studio.exports.save` IPC method accepting a suggested filename, supported format, and serialized content.
2. Validate payload size, extension, and format in the main process before showing `dialog.showSaveDialog`.
3. Write atomically where practical and return a typed cancelled/saved/error result without exposing unrestricted filesystem APIs.
4. Build one snapshot for preview, then serialize the current project again at save time to avoid exporting stale Review data.
5. Surface overwrite, cancellation, and write failures in the renderer with focus restoration.

## PDF renderer handoff

Polished PDF generation remains unimplemented. A renderer should consume `ExportSnapshot`, not `ProjectState`, and must cover title/source summaries, kept entries, a clearly labeled Maybe section, confidence notes, page references, Unicode fonts, long-text pagination, and optional excluded/audit appendices. Add structural tests and reopen the generated PDF before claiming completion.
