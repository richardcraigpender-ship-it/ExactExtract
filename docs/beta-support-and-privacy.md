# Windows beta support and privacy

## Launch platform

The first public beta targets Windows 10/11 x64. macOS and Linux packaging remain later targets until their installer and OCR asset behavior are verified.

## Supported limits

- PDF files up to 250 MB.
- Up to 2,000 pages per PDF.
- Up to 50 source documents per project.
- English, Spanish, French, and German OCR data is installed with the application and does not require a runtime download.

These limits are guardrails for predictable memory use and may be revised after large-project profiling.

## Privacy

EXACT EXTRACT processes PDFs and stores projects locally. Source paths and extracted contents are not uploaded by the application. Tesseract worker, core, and supported language assets are bundled with the release build for offline OCR startup.

Export snapshots omit source filesystem paths. Future hosted extraction providers must be optional, explicitly enabled, and documented before any source content leaves the device.

## Recovery expectations

Projects store source references, not embedded PDF copies. Moving or deleting a source PDF requires locating or restoring it before extraction/viewing can continue. Autosave failures must remain visible and retryable, and the app should prevent silent close while changes are unsaved or a save is active.

Uninstall removes the application, per-user registration, and shortcuts but retains the Electron user-data directory so projects and the local payee library survive reinstall. Delete retained data manually only after confirming it is no longer needed.

## Windows installation troubleshooting

The beta installer and executable are not Authenticode-signed, so Windows SmartScreen may warn that the publisher is unknown. Obtain the installer only from the trusted release location and compare its SHA-256 value with `release-manifest.json`. When the hash matches, choose **More info > Run anyway**. Do not bypass the warning for an installer with a missing or different hash.

The supported lifecycle is a per-user install, same-version reinstall, and uninstall. Maintainers can verify it with:

```bash
npm run verify:windows-lifecycle
```

## OCR troubleshooting

- OCR supports bundled English, Spanish, French, and German data and should initialize offline.
- If OCR cannot start, restart the application, select a bundled language, and retry extraction.
- If a scan produces sparse or incorrect text, confirm the language and page range, then retry with Balanced or Maximum extraction.
- Rotated, mixed text-and-image, and scanned PDFs are supported, but every result should be reviewed against its source highlight before export.
- OCR stays local. A network prompt or runtime language download is not expected behavior for the supported languages.
