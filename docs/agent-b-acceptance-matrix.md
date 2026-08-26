# Agent B acceptance matrix

Assessment date: 2026-08-25. Scope: reliability, recovery, accessibility, responsive behavior, and deterministic resource cleanup on the current source tree.

The workload is split into two tracks: **B1 Reliability and recovery** and **B2 Accessibility and responsive acceptance**. The tables below are grouped by track; the final decision is shared.

B1 implementation and automated acceptance were completed on 2026-08-24. Packaged native recovery and the installed Windows lifecycle were accepted on 2026-08-25. Clean-account/VM interaction remains Not Tested.

## Classification rules

- **Verified:** executable evidence directly exercises the stated behavior.
- **Partial:** implementation or lower-level evidence exists, but native or installed interaction is incomplete.
- **Blocked:** a known defect prevents acceptance.
- **Not Tested:** the required environment or manual workflow was not exercised.

## B1 - Failure and limit acceptance

| Case                     | Status   | Evidence                                                                                                                                              | Residual-risk decision                                                             |
| ------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Encrypted PDF            | Partial  | PDF.js loads the real password-protected `encrypted-password.pdf` fixture and the production classifier returns actionable unlock guidance.           | Native chooser and rendered alert flow remain manual.                              |
| Malformed PDF            | Partial  | PDF.js rejects the real-byte `malformed-truncated.pdf` fixture and the production classifier returns actionable replacement guidance.                 | Native chooser and rendered alert flow remain manual.                              |
| Unsupported PDF          | Partial  | Unsupported errors produce a non-retry processing message through the integrated classifier.                                                          | No representative unsupported-feature fixture exists.                              |
| Missing source PDF       | Verified | Packaged native single/multi-file relinking reported `1 missing source recovered.` and `2 missing sources recovered.`; paths persisted after restart. | No residual functional risk identified.                                            |
| File larger than 250 MB  | Verified | Import batch validation rejects `maxFileBytes + 1` before document state is merged.                                                                   | No 250 MB binary fixture is retained; pure boundary evidence is accepted for beta. |
| PDF over 2,000 pages     | Verified | Preflight applies `validatePdfLimits(size, pageCount)` before committing any analysis result; boundary test rejects page 2,001.                       | Real 2,001-page rendering was not run.                                             |
| More than 50 source PDFs | Verified | Batch validator allows 50 unique paths, ignores duplicates, and rejects the 51st before state mutation.                                               | No residual functional risk identified.                                            |
| No partial corruption    | Partial  | Preflight uses atomic `Promise.all`; extraction batch preserves completed-document results and project-store writes are atomic.                       | Native interruption during disk write remains manual.                              |

## B1 - Recovery acceptance

| Case                           | Status   | Evidence                                                                                                                                                                                                               | Residual-risk decision                                               |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| One missing-source relink      | Verified | The packaged chooser accepted one replacement, announced `1 missing source recovered.`, and persisted the replacement path.                                                                                            | No residual functional risk identified.                              |
| Multiple missing-source relink | Verified | The packaged multi-select chooser matched two replacements, announced `2 missing sources recovered.`, and retained both paths after restart.                                                                           | No residual functional risk identified.                              |
| Save failure and Retry Save    | Verified | An exclusive project-file lock produced the real atomic-rename `EPERM` alert and an enabled, focusable Retry Save action. After unlock, Retry Save cleared the error and persisted `theme: dark` with a new timestamp. | No residual functional risk identified.                              |
| Interrupted extraction         | Verified | Cancellation, partial-result handling, OCR cleanup, and active-operation close guard have executable coverage.                                                                                                         | Installed interaction remains part of final candidate acceptance.    |
| Interrupted export             | Partial  | Export-in-progress blocks close and save cancellation paths exist.                                                                                                                                                     | Native cancellation and overwrite failure interaction remain manual. |
| Keep working close choice      | Verified | A locked save created a dirty state; the packaged native `Close EXACT EXTRACT?` dialog exposed both choices. Invoking `Keep working` removed the dialog, re-enabled the main window, and retained the process.         | No residual functional risk identified.                              |
| Close without saving choice    | Verified | Repeating the dirty close and invoking `Close without saving` removed the native dialog and terminated the packaged process cleanly.                                                                                   | No residual functional risk identified.                              |
| Close during extraction/export | Verified | `shouldBlockClose` and operation-specific messages pass in `src/recovery/projectRecovery.test.ts`; renderer sends reactive operation state.                                                                            | No residual source-level risk identified.                            |

## B2 - Accessibility acceptance

| Case                               | Status   | Evidence                                                                                                                                                               | Residual-risk decision                                                              |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Keyboard-only complete workflow    | Partial  | Live UI Automation reached Home, import, preflight, Review, Analysis, Export, and named export controls with keyboard focus.                                           | Native chooser/OCR prevented a complete create-to-export pass.                      |
| Critical control labels and states | Verified | With Windows Narrator running, live UIA exposed named/focusable workspace controls and changed `Keep entry 1` from pressed Off to On without losing focus.             | Spoken wording across every screen remains a manual boundary.                       |
| Entry editor focus restoration     | Verified | Cancel/save captures the invoking control and restores focus after editor unmount.                                                                                     | Installed keyboard spot-check recommended.                                          |
| Dialog focus, Tab trap, and Escape | Verified | Live UIA identified the modal `Configure kept export` Window, moved focus to its named Close control, and restored focus to the opener; source tests cover Tab/Escape. | Native warning choices also pass packaged acceptance.                               |
| Progress and error announcements   | Partial  | Autosave and extraction progress now use explicit atomic polite status semantics; errors retain assertive alert semantics. A focused status test passes.               | Narrator/UIA emitted no observable live-region event; spoken output remains manual. |
| Recovery and export announcements  | Partial  | Recovery and export expose explicit status semantics in source.                                                                                                        | Dynamic spoken announcements were not observed in this spot-check.                  |

## B2 - Responsive and resource acceptance

| Case                            | Status   | Evidence                                                                                                                                                                                                                                                       | Residual-risk decision                                                 |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 100%, 150%, and 200% scaling    | Verified | Isolated-profile Electron runs reported renderer scale factors 1, 1.5, and 2. Settled captures at a 520 px logical width showed coherent light-theme layouts at every scale and dark-theme home/workspace layouts at 200%; Review and Search remained unified. | Installed-candidate and system-display-setting spot-check recommended. |
| Narrow window                   | Verified | Live Electron was resized to the 520 x 700 minimum; the viewer stacks above the unified Review/Search workspace and UIA plus screenshot evidence confirms modes and Export actions remain reachable without horizontal page overflow.                          | Vertical scrolling remains expected for below-fold actions.            |
| Light and dark themes           | Verified | Live theme switching succeeded and both actual semantic variable sets pass the CSS-backed contrast suite.                                                                                                                                                      | Installed-candidate visual spot-check remains recommended.             |
| Reduced motion                  | Verified | `prefers-reduced-motion: reduce` globally minimizes animation and transition duration.                                                                                                                                                                         | No residual source-level risk identified.                              |
| Contrast                        | Verified | `themeContrast.test.ts` reads the actual light/dark semantic variables and verifies normal-text pairs at WCAG AA 4.5:1.                                                                                                                                        | Canvas/PDF content remains outside semantic-token coverage.            |
| Large entry-list responsiveness | Verified | The list now renders only the visible viewport slice plus overscan; the focused 120-entry regression excludes all rows outside the calculated range. The pre-fix 2,958-entry UIA measurement remains baseline evidence.                                        | Installed quantitative remeasurement is recommended.                   |
| Repeated-operation resources    | Partial  | PDF documents, OCR canvases, and OCR workers have deterministic success/failure/cancellation cleanup tests.                                                                                                                                                    | Quantitative repeated heap profiling remains Agent C-owned.            |

## Executable evidence

Run from the repository root:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

The Agent B source gate passes 277/277 tests plus Node/renderer typechecks and focused formatting. The current Windows candidate also passes packaged OCR verification and `verify:windows-lifecycle`: silent install, installed launch, candidate hash parity, same-version reinstall, clean close, quiet uninstall, and cleanup. Narrator speech output and quantitative heap checks are not replaced by these commands.

## Decision

**B1 status: Complete for the Windows beta candidate.** Focused suites cover limits, invalid import metadata, close guards, relinking decisions, project persistence, and real-byte encrypted/malformed PDF classification. Packaged native evidence covers one/multiple relinking, the rendered save failure and successful retry, and both dirty-close choices. Installed lifecycle acceptance passes end to end.

**B2 status: Complete for source remediation and explicit classification.** Narrow-window behavior, 100/150/200% renderer scaling, semantic contrast, focus restoration, modal keyboard behavior, live-region contracts, and list virtualization are Verified. Keyboard workflow remains Partial and Narrator speech remains manual.

**Agent B decision: Pass for Windows beta handoff.** Human-audible Narrator announcements and clean-account/VM interaction remain explicit manual boundaries. Overall public-release approval remains owned by the integrated release decision and its accessibility/performance risk policy.
