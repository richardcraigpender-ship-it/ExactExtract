# EXACT EXTRACT

Local-first Windows desktop application for importing PDFs, extracting embedded text and scanned content, reviewing traceable entries, calculating kept-only metrics, and exporting reviewed results.

## Windows beta scope

- Windows 10/11 x64 is the declared beta target.
- PDFs stay on the local device. Project data is stored under Electron's user-data directory.
- Supported guardrails: 250 MB per PDF, 2,000 pages per PDF, and 50 documents per project.
- English, Spanish, French, and German OCR data is bundled for offline worker startup.
- PDF, CSV, JSON, and kept-entry image exports are integrated. The Windows installer lifecycle has native acceptance coverage.

See [beta support and privacy](docs/beta-support-and-privacy.md) for details.

## Recommended IDE setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# Typecheck and production bundle
npm run build

# Unpacked Windows application
npm run build:unpack

# Windows installer
npm run build:win

# Isolated Windows beta candidate plus artifact verification
npm run build:win-beta

# Installed Windows lifecycle acceptance (install, launch, reinstall, uninstall)
npm run verify:windows-lifecycle
```

## Current workflow

1. Create or open a local project.
2. Import one or more PDFs.
3. Review preflight findings and choose Fast, Balanced, Maximum, or Custom extraction.
4. Extract and review source-linked entries beside the PDF.
5. Mark entries Keep, Maybe, or Exclude; edit, filter, and bulk-review them.
6. Open Analysis for kept-only metrics and validation.
7. Export the reviewed result as PDF, CSV, JSON, or kept-entry images.

## Data and recovery

Projects reference source PDF paths rather than embedding full PDF copies. If a source is moved or deleted, restore or locate it before viewing/extraction can continue. Autosave errors should be retried before closing.

Uninstall removes the application, registration, and shortcuts but intentionally retains project data in the Electron user-data directory. Remove that directory separately only when its projects and payee data are no longer needed.

## Troubleshooting

- **Windows SmartScreen:** the beta is not Authenticode-signed. Install only an artifact obtained from the trusted release location and verify its SHA-256 value against `dist-windows-beta/release-manifest.json` before choosing **More info > Run anyway**.
- **OCR does not start:** confirm that the selected language is English, Spanish, French, or German, restart the application, and retry extraction. OCR is local and should not require a network connection.
- **OCR output is incomplete:** use Balanced or Maximum extraction, confirm the correct page range and language, then review low-confidence entries against their highlighted source regions.
- **A source PDF is missing:** restore it to its original path or use the recovery flow to locate it before extraction or viewing.

## Known beta limitations

- OCR production wiring, offline packaging, and representative scanned/mixed/rotated pipeline checks are automated; interactive Electron OCR workflow acceptance remains manual.
- Recent Projects recovery UI exists as a standalone component but awaits central routing integration.
- Isolated-profile unpacked and installed launch acceptance passes. A separate clean Windows account or VM has not been tested.
- Authenticode signing is not configured; beta installers may show Windows SmartScreen warnings.
