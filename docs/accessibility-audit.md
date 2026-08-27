# Accessibility audit

Audit date: 2026-08-25. Scope: current Electron renderer components and standalone recovery/Analysis/Export surfaces.

## Verified

- Screen changes focus their main heading.
- PDF/review pane separator is keyboard operable with Arrow, Home, and End keys and exposes ARIA values.
- Review decisions and workspace modes expose pressed state.
- Icon-only controls generally have titles or accessible labels.
- Review keyboard decisions ignore inputs, textareas, selects, and contenteditable controls.
- Errors use alert semantics; save and progress feedback use live regions where integrated.
- Reduced-motion CSS disables animation and transition duration globally.
- Light/dark themes use shared semantic colors and visible focus outlines.

## Findings

| Severity   | Surface             | Finding                                                                                                                                                                                                                                                                     | Remediation                                                                                    |
| ---------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Remediated | Entry list          | Review entries are windowed to the visible viewport plus overscan instead of rendering every project entry.                                                                                                                                                                 | Repeat the prior 2,958-entry installed UIA measurement on the final candidate.                 |
| Remediated | Dialog/editor close | Entry-editor cancel/save restores focus to its invoking control; modal tool windows restore opener focus and close on Escape.                                                                                                                                               | Confirm focus and announcement behavior with Narrator on the installed candidate.              |
| Remediated | PDF highlights      | Selected single-region overlays expose page-relative position and size through `aria-describedby`; the visual overlay is hidden from assistive technology. The viewer additionally exposes a per-page marked-region count with a keep/maybe/exclude breakdown whenever the status overlay is visible.                                                              | Confirm the count wording with Narrator on the installed candidate.                            |
| Remediated | Analysis            | Financial metric and grouped-total sections expose the complete sentence "All monetary values in this section are in GBP." as one assistive-technology text node.                                                                                                           | Derive currency from project configuration when that contract is introduced.                   |
| Remediated | Recent projects     | Missing-source recovery results are announced through a polite status live region.                                                                                                                                                                                          | Confirm announcement wording with Narrator on the installed candidate.                         |
| Partial    | Live announcements  | Autosave and extraction progress now expose explicit atomic polite status roles, while errors use assertive alerts. With Narrator active, UIA exposed no LiveSetting property or observable live-region event during a real decision/autosave change.                       | Complete a human-audible installed Narrator pass for progress, errors, recovery, and export.   |
| Remediated | Responsive layout   | Live isolated-profile Electron acceptance confirms 1, 1.5, and 2 renderer scales at a 520 px logical width. Light-theme captures pass at every scale; dark home/workspace captures pass at 200%, preserving unified Review/Search and reachable Analysis/Export navigation. | Installed-candidate and system-display-setting spot-check recommended.                         |
| Remediated | Color               | Actual light/dark semantic foreground/background variables pass an automated WCAG AA 4.5:1 normal-text contrast check.                                                                                                                                                      | Continue checking new semantic color pairs as they are added.                                  |

## Required acceptance checks

1. Complete create/import/extract/review/analyze/export with keyboard only.
2. Spot-check logical tab order and visible focus on the installed candidate at 100%, 150%, and 200% system scaling.
3. Complete a human-audible Narrator pass for progress, errors, recovery, and export completion.
4. Verify reduced-motion mode and both themes.
5. Run automated accessibility checks on every mounted screen, then manually test canvas/PDF interactions.

## Remediation evidence - 2026-08-18

- PDF viewer highlight descriptions identify page, left/top position, width, and height as percentages.
- The viewer links the description only while a highlight is active.
- Focused formatter test, renderer typecheck, and Agent C-owned lint pass.

## Remediation evidence - 2026-08-24

- Entry-editor cancel/save restores focus to the Edit control that opened it.
- Workspace and kept-entry export dialogs provide labelled modal semantics, trapped Tab navigation, opener focus restoration, and Escape close behavior.
- Extraction progress, recovery results, export status, and errors use status/live-region or alert semantics.
- The independent status and residual-risk classification is in `docs/agent-b-acceptance-matrix.md`.
- Analysis currency descriptions are complete text nodes and appear twice in the live Windows UI Automation tree.
- The CSS-backed contrast suite verifies light and dark semantic text pairs at 4.5:1 or better.
- Live Electron at the 520 x 700 minimum stacks the PDF viewer above the unified Review/Search workspace; the mode strip and Export actions fit the viewport, with vertical scrolling for below-fold actions.
- Isolated-profile Electron runs confirmed Chromium renderer scale factors 1, 1.5, and 2. Settled captures at a 520 px logical width passed at all three scales in light theme; 200% dark-theme home and loaded-workspace captures also passed. Review and Search remain one continuous panel, with Analysis and Export reachable from compact navigation.
- The pre-remediation 2,958-entry project produced 1,504 UIA nodes and 525 focusable nodes in a 2,573 ms enumeration. The list is now virtualized; the focused 120-entry regression renders only the viewport slice plus overscan. Final installed quantitative remeasurement remains follow-up evidence.

## Narrator spot-check - 2026-08-25

- Windows Narrator ran against an isolated Electron profile with renderer accessibility forced.
- UIA exposed named controls for workspace modes, filters, theme, export commands, and per-entry decisions. `Keep entry 1` remained focused while its pressed state changed from Off to On.
- The modal `Configure kept export` was exposed as a named modal Window. Focus moved to `Close Configure kept export` and returned to the opener after close.
- The native warning was exposed as `Close EXACT EXTRACT?`, included the actionable unsaved-save message, exposed both close choices, and defaulted focus to `Keep working`. Native Win32 button invocation verified that `Keep working` dismissed the dialog and restored the enabled app, while `Close without saving` terminated the packaged process.
- Autosave and extraction progress were strengthened with explicit `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`. The focused regression passes, but Chromium emitted no observable UIA live-region event during the Narrator-enabled state change; spoken output is not claimed.

## Packaged recovery spot-check - 2026-08-25

- Packaged single- and multi-source native relinking exposed enabled, focusable recovery controls and visible `1 missing source recovered.` / `2 missing sources recovered.` status text. Replacement paths persisted after restart.
- A real locked-file autosave failure exposed `Autosave failed`, the exact atomic-rename `EPERM` detail, and an enabled, focusable `Retry save` command. Retrying after unlock cleared the recovery UI and persisted the changed theme.
- The Windows lifecycle verifier passed silent install, installed launch, executable hash parity, same-version reinstall, clean close, quiet uninstall, and cleanup for the current candidate.
## Remediation evidence - 2026-08-27

- The PDF viewer exposes a per-page marked-region summary (for example `3 marked source regions on page 2: 2 keep, 1 exclude.`) whenever the status overlay is visible, so assistive technology is no longer limited to the single selected region while the visual overlay stays `aria-hidden`.
- The summary is linked through `aria-describedby` alongside the existing selected-region description, and is omitted when the overlay is hidden or the page has no marked regions.
- Covered by focused unit tests for the plural, singular, default-status, and empty-page wordings in `src/renderer/src/components/PdfViewer.test.ts`.
- Human-audible Narrator confirmation of the count wording remains follow-up evidence.
