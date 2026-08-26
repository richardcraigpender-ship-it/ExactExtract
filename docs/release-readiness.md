# Release readiness

## Verification snapshot - 2026-08-25

The final Windows beta candidate passes automated quality, offline and packaged OCR, real-byte OCR fixtures, native recovery, clean packaging, and the local installed lifecycle. The release posture is **Beta Go** for controlled Windows beta distribution. Unsigned binaries, clean-account/VM coverage, human-audible Narrator announcements, and the complete installed interactive OCR workflow are explicit beta exceptions, not claimed as tested.

## Verified

- Repository formatting and ESLint pass.
- The configured test suite passes 277/277 tests with no failures, cancellations, skips, or todo cases.
- `npm run typecheck` passes for the Node and renderer projects.
- `npm run build` passes main, preload, renderer, and PDF worker bundling. Vite emits one non-blocking note because `PdfViewer.tsx` is imported both statically and dynamically.
- Offline Tesseract startup passes for bundled English, Spanish, French, and German data without a runtime download.
- Deterministic real-byte scanned, mixed, and 90-degree rotated fixtures pass PDF.js checks and the full extraction adapter, OCR mapping, PDF-point projection, traceability, and parser/OCR merge workflow.
- PDF.js documents are destroyed after preflight/extraction success, failure, and cancellation. Rasterized OCR canvas buffers are released after recognition and on recognition failure or cancellation; Tesseract worker termination remains covered.
- The final Windows candidate contains 3,658 ASAR entries, 11 required runtime files, and seven unpacked OCR files. Source, scripts, tests, docs, maps, coordination files, nested archives, and recursive distribution outputs are excluded.
- Packaged OCR verification passes against `dist-windows-beta/win-unpacked/resources/app.asar`.
- Product identity is consistent: `EXACT EXTRACT`, app ID/model ID `com.exactextract.app`, and executable `exact-extract.exe`.
- Project persistence acceptance covers rich analysis/layout state across a fresh-store reopen, retry after a real filesystem save failure, recent-project ordering, and isolation of saved projects and global payees when a Recent item is removed.
- Local lifecycle acceptance covers per-user install, responsive native launch with an isolated user-data directory, same-version reinstall, quiet uninstall, and cleanup of registration, application files, shortcuts, and processes. User data is retained by policy.
- Final environment: Windows 11 Pro 10.0.26200, Node 24.18.0, npm 11.16.0, Electron 41.10.3, and electron-builder 26.15.3.
- `npm audit --omit=dev --audit-level=high` reports zero vulnerabilities. Electron 41.10.3 replaces the vulnerable Electron 39 `extract-zip` build chain and clears the subsequent sandboxed-iframe advisory affecting earlier Electron 40/41 releases.
- The Review list renders only its visible slice plus overscan. The focused 120-entry regression renders entries 1-4 at the test viewport and excludes entries 5-120, eliminating the prior all-rows DOM/focus footprint.
- Packaged native acceptance verifies single- and multi-source relinking with restart persistence, real locked-file Retry Save recovery, `Keep working`, and `Close without saving`.
- The representative 29-page Revolut statement produces 574 dated, traceable transactions; card/reference digits are excluded, money-out is £7,542.18, money-in is £8,729.21, opening balance is £53.55, closing balance is £1,240.58, calculated closing is £1,240.58, and reconciliation difference is £0.00.
- The compact representative Revolut part-1 statement produces 8 dated, payee-linked, source-traceable entries with £54.24 money-out, £170.00 money-in, £115.76 net movement, zero unmapped rows, and a £0.00 reconciliation difference.

## Final candidate

| Artifact                                 |       Bytes | SHA-256                                                            |
| ---------------------------------------- | ----------: | ------------------------------------------------------------------ |
| `exact-extract-1.0.0-setup.exe`          | 181,186,671 | `0c969229e10c70b202bf7499d0931d635506b2b0b436e033d2f71fed86ccd6a0` |
| `exact-extract-1.0.0-setup.exe.blockmap` |     191,190 | `440b5849c2efbf3796a88b937542435a96ea1f83ff09711c0ae56aee6b36eecf` |
| `exact-extract.exe`                      | 223,840,256 | `4c2fc61a281290901bcf46a13b4e4ca32f5942b9a514b3177402a3a0c8b96781` |
| `app.asar`                               | 134,888,114 | `540705932b1cbfaa125762949c523ba500aa593f34285e69915151a108ee7496` |

Machine-readable artifact evidence is in `dist-windows-beta/release-manifest.json`; lifecycle evidence is written to `dist-windows-beta/lifecycle-manifest.json` by `npm run verify:windows-lifecycle`.

## Partial

- OCR provider, rasterizer, orchestration, progress, cancellation, multi-document failure handling, and real-PDF pipeline behavior have executable coverage. Installed interactive Import -> OCR -> Review -> Export -> reopen acceptance remains manual.
- Accessibility source remediation, narrow-window behavior, 100/150/200% renderer scaling, themes, reduced motion, semantic contrast, modal focus, and live-region contracts are verified; complete keyboard/Narrator acceptance remains incomplete.
- Template/export and generic workspace dialogs now use a shared Tab focus trap, restore focus to the opener on close, provide labelled modal semantics, and support Escape to close. Screen-reader and scaling acceptance remain manual checks.
- Page removal has confirmation/cancellation, persists across reopen, uses reduced PDF bytes for source exports, and supports dedicated undo/redo. Multi-document batch selection remains incomplete.
- The historical `pdf-extract-review-studio` user-data directory name is retained so upgrades do not orphan existing projects and global payees.
- The installer is approximately 169.1 MiB, which remains a documented beta distribution risk.
- Quantitative repeated-operation memory profiling and close-during-active-export interaction remain incomplete; deterministic PDF/OCR cleanup and operation-specific close guards are implemented and tested.
- The Review list is virtualized, but the prior 2,958-entry installed UIA measurement has not been repeated against this final candidate.

## Accepted for beta

- The installer and executable are not Authenticode-signed. Windows SmartScreen warnings are expected until a certificate and signing pipeline are configured. Users must verify the installer hash before bypassing a warning.
- Uninstall intentionally retains project and payee data.
- The historical user-data directory name remains visible in filesystem paths for upgrade compatibility.
- A separate clean Windows account/VM is unavailable on the acceptance machine. The exact candidate instead passed isolated-profile native launch plus install/reinstall/uninstall and hash-parity acceptance.
- Human-audible Narrator announcements and a complete installed interactive Import -> OCR -> Review -> Export -> reopen pass remain manual follow-up. Source-level accessibility, UIA names/states/focus, packaged recovery, packaged OCR assets, and real-byte OCR workflows passed.

## Blocked

- None for controlled Windows beta distribution.
- Authenticode signing, clean-account/VM execution, and complete assistive-technology acceptance remain required before promoting this posture from Beta to unrestricted public Go.

## Not tested

- A separate clean Windows account or VM. Isolated `--user-data-dir` checks are not equivalent. Windows Sandbox is unavailable and no Hyper-V VM is configured on the acceptance machine.
- Installed interactive digital/scanned/mixed/rotated Import -> OCR -> Review -> Export -> reopen behavior.
- Assistive-technology operation across the complete installed workflow.
- Clean-account/VM acceptance.

## Real Image Acceptance Evidence

- `test-data/fixtures/20260816_223738.jpg`, `20260816_223738.pdf`, and `bank-statement-blog-image.pdf` are photographed or blog-image bank statement inputs. Direct bundled-English Tesseract recognition on 2026-08-24 produced traceable OCR regions but unreliable financial text because of image noise, perspective, glare, and low contrast. The acceptance regression confirms both PDFs produce zero fabricated financial rows. Do not use them as evidence of acceptable OCR financial quality.
- Release follow-up: add deskew/contrast preprocessing validation or obtain a flat, higher-resolution scan before accepting photographed statements. The deterministic scanned/mixed/rotated PDF fixtures remain the verified OCR-quality evidence.

## Decision

**Beta Go.** The exact Windows candidate is approved for controlled beta distribution with the published SHA-256 hash and documented SmartScreen instructions. Automated, OCR, recovery, package, security-audit, and installed-lifecycle gates pass. This is not an unrestricted public-release Go: signing, clean-account/VM evidence, and complete human-audible Narrator/installed interactive workflow acceptance remain promotion conditions.
