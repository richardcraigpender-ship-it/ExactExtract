# Item 3: Native Recovery Acceptance Tests

## Executive Summary

Recovery logic is comprehensively tested at the source level (274/274 tests passing). This document defines the manual UI verification steps for the five recovery paths required for B1 acceptance.

**Source-Level Verification Status:** ✅ Complete

- Close-guard messages tested ([src/recovery/projectRecovery.test.ts](src/recovery/projectRecovery.test.ts#L42-L63))
- Retry Save infrastructure tested ([src/main/projectStore.test.ts#L139](src/main/projectStore.test.ts#L139))
- Relinking match logic tested ([src/recovery/projectRecovery.test.ts#L71](src/recovery/projectRecovery.test.ts#L71))
- Save failure message formatting tested

**Manual UI Verification Status:** To be completed

- Native close dialogs (Keep working / Close without saving buttons)
- Native file chooser during relinking
- Retry Save alert rendering
- Export interruption blocking

## Test Environment

**Prerequisite:** exact-extract.exe installed or dev server running

- Installed: `%LOCALAPPDATA%\Programs\exact-extract\exact-extract.exe`
- Dev: Terminal running `npm run dev` (already running)

## Test Plan

### Test 1: Close Dialog – "Keep working" (Defensive Path)

**Objective:** Verify dialog appears and cancel works

**Steps:**

1. Launch app (installed or dev)
2. Import a PDF (any test PDF, e.g., from `test-data/fixtures/`)
3. Make a change: Merge or split an entry in the Review workspace
4. Do NOT save (Skip or cancel save dialog if prompted)
5. Close app (Cmd+Q on macOS, Alt+F4 on Windows, or File → Exit)
6. **Expected:** Dialog appears:
   - Title: "Close EXACT EXTRACT?"
   - Message: Mentions "not finished saving" or similar
   - Buttons: "Keep working" (left, default), "Close without saving" (right)
7. Click "Keep working"
8. **Expected:** Dialog closes, app remains open, unsaved changes preserved
9. Verify: The modified entry is still visible in Review workspace

**Evidence to Document:**

- Screenshot: Dialog with both buttons visible
- Action sequence: Dialog → "Keep working" → App stays open
- Confirmation: Unsaved state unchanged

**Result:** ☐ Pass / ☐ Fail / ☐ Partial

---

### Test 2: Close Dialog – "Close without saving" (Destructive Path)

**Objective:** Verify destructive choice exits and reverts project

**Steps:**

1. (Continuing from Test 1) Or start fresh: Import PDF and make unsaved changes
2. Close app again (Cmd+Q, Alt+F4, or File → Exit)
3. Dialog appears (as Test 1)
4. Click "Close without saving"
5. **Expected:** App closes cleanly, no save confirmation
6. Reopen app (Run exact-extract.exe or dev terminal still active)
7. **Expected:**
   - Home screen appears (no unsaved project recovery)
   - If you open the same project file manually, it shows the original state (changes discarded)

**Evidence to Document:**

- Screenshot: Dialog → "Close without saving" clicked
- Screenshot or log: App exit status code 0 (clean exit)
- Screenshot: Reopened app shows Home (not recovery) or reverted project state

**Result:** ☐ Pass / ☐ Fail / ☐ Partial

---

### Test 3: Saved Project Close – No Dialog (Happy Path)

**Objective:** Verify saved projects close without prompts

**Steps:**

1. Import PDF and make changes
2. Explicitly save project (File → Save or Ctrl+S)
3. **Expected:** Save succeeds, no error
4. Close app (Cmd+Q, Alt+F4, File → Exit)
5. **Expected:** App closes immediately, no dialog
6. Reopen app
7. **Expected:** Project recovers with saved state intact

**Evidence to Document:**

- Screenshot: App closing without dialog
- Screenshot: Reopened app with recovered saved project
- Entry count or review state matches what was saved

**Result:** ☐ Pass / ☐ Fail / ☐ Partial

---

### Test 4: Single Missing Source – Relinking

**Objective:** Verify relinking dialog and file chooser for one renamed PDF

**Steps:**

1. Create a project with one PDF source:
   - Import PDF from `test-data/fixtures/statement-sample.pdf` (or similar)
   - Save project
2. Close app
3. **Outside the app:** In file explorer, rename the PDF:
   - E.g., `statement-sample.pdf` → `statement-sample-renamed.pdf`
   - Keep it in same directory or move it elsewhere
4. Reopen app
5. Open the project file (File → Open Recent or manually select .json file)
6. **Expected:** Recovery dialog appears with message:
   - "The following source files are missing and need to be relinked:"
   - List shows original filename: "statement-sample.pdf"
7. Click "Browse" or file chooser button
8. Navigate to and select the renamed PDF: `statement-sample-renamed.pdf`
9. **Expected:** System file chooser confirms selection
10. **Expected:** Project loads with correct page count and extracted text
11. Verify: Review workspace shows extracted entries, stats are correct

**Evidence to Document:**

- Screenshot: Recovery dialog with missing file listed
- Screenshot: File chooser with renamed file highlighted
- Screenshot: Project loaded successfully with correct data
- Verification: Entry count and sample text match original import

**Result:** ☐ Pass / ☐ Fail / ☐ Partial

---

### Test 5: Multiple Missing Sources – Relinking with Ambiguity

**Objective:** Verify multi-select relinking and that ambiguous cases don't auto-guess

**Steps:**

1. Create a project with 2+ PDF sources:
   - Import `test-data/fixtures/statement-sample.pdf` as Document 1
   - Import `test-data/fixtures/pdf-with-ocr.pdf` as Document 2
   - Save project
2. Close app
3. **Outside the app:** Rename both PDFs:
   - `statement-sample.pdf` → `doc-a.pdf`
   - `pdf-with-ocr.pdf` → `doc-b.pdf`
4. Reopen app and open the project
5. **Expected:** Recovery dialog lists both missing files:
   - "statement-sample.pdf (missing)"
   - "pdf-with-ocr.pdf (missing)"
6. Click "Browse" for the first missing file
7. **Partial match scenario:** Select a replacement PDF that has a _different_ filename
   - E.g., select `renamed-doc-c.pdf` instead of name-matching one
8. **Expected:** Chooser accepts selection
9. **Expected for second file:** Either:
   - Auto-match by name if remaining selected PDFs include matching name (Good)
   - Require explicit selection again (Also acceptable)
10. **Important test case:** If you select only 1 PDF but need 2, app should:
    - Show error: "Need to relink 2 files, but only 1 was selected"
    - Require re-selection (does NOT guess/auto-assign)

**Evidence to Document:**

- Screenshot: Recovery dialog with multiple missing files
- Screenshot: File chooser for first selection
- Screenshot: Success/error for second selection
- Confirmation: App does not guess when counts don't match

**Result:** ☐ Pass / ☐ Fail / ☐ Partial

**Note:** If name-based matching succeeds, verify it only matched exact names, not similar names.

---

### Test 6: Save Failure and Retry Save Alert

**Objective:** Verify Retry Save button works (filesystem failure scenario)

**Challenging Test:** Requires forcing a save failure, which is hard without native tools.

**Recommended Approach:**

1. Open any project with unsaved changes
2. Trigger save (Ctrl+S or File → Save)
3. Watch for the following:
   - If save fails (e.g., disk full, permission denied), alert appears with "Retry Save" button
   - Retry button is visible and clickable
   - Clicking Retry re-attempts the save

**Alternative Workaround** (if no natural failure occurs):

- This path is covered at source level (projectStore.test.ts)
- Mark as "Deferred – no natural failure observed" if manual triggering not feasible

**Evidence to Document:**

- Screenshot: Retry Save alert (if captured)
- Or: Confirmation that source-level test coverage is sufficient

**Result:** ☐ Pass / ☐ Fail / ☐ Deferred (source level only)

---

### Test 7: Export Interruption – Close Blocked During Active Export

**Objective:** Verify app blocks close while export is in progress

**Steps:**

1. Create or open a project with extracted entries
2. Start export to PDF or CSV (File → Export or Review → Export button)
3. **While export is running:** Attempt to close app (Cmd+Q, Alt+F4, File → Exit)
4. **Expected:** Dialog appears (same as close-guard):
   - Message mentions "export in progress" or similar
   - Buttons: "Keep working" (cancel close) or "Close without saving"
5. Click "Keep working"
6. **Expected:** Close is prevented, export continues
7. Wait for export to complete
8. Close app again
9. **Expected:** No dialog (export finished, no block)

**Alternative Export Test:**

- If quick export completes before close can be attempted:
  - Start extraction (if not already done): File → Import or re-import large PDF
  - While extraction is running, attempt close
  - Verify same dialog with extraction-in-progress message appears

**Evidence to Document:**

- Screenshot: Close dialog with export/extraction message
- Confirmation: App does not close prematurely
- Verification: Export/extraction completes after "Keep working"

**Result:** ☐ Pass / ☐ Fail / ☐ Partial

---

## Acceptance Criteria

| Test                            | Required? | Status | Notes                                   |
| ------------------------------- | --------- | ------ | --------------------------------------- |
| 1. Keep working                 | Yes       | ☐      | Dialog cancel path                      |
| 2. Close without saving         | Yes       | ☐      | Destructive path, revert verified       |
| 3. Saved close (no dialog)      | Yes       | ☐      | Happy path, state preserved             |
| 4. Single missing source relink | Yes       | ☐      | One file, one choice                    |
| 5. Multiple missing sources     | Yes       | ☐      | No false guessing                       |
| 6. Retry Save                   | Optional* | ☐      | Source level tested; manual if feasible |
| 7. Export interruption          | Yes       | ☐      | Blocks close during active export       |

*Retry Save: Marked optional because projectStore.test.ts covers the logic. Mark "Pass" if alert observed, or "Deferred (source level)" if manual scenario not reproduced.

## Failure Paths Covered by Source Tests

✅ `close-guard-extraction` – Close blocked while extraction active  
✅ `close-guard-export` – Close blocked while export active  
✅ `save-failure-retry` – Retry Save message formatting  
✅ Recovery for missing sources (single and multiple)

See [src/hardening/acceptanceManifest.test.ts](src/hardening/acceptanceManifest.test.ts#L42-L43) for confirmation.

## How to Run This Acceptance Plan

1. **Use Installed Candidate** (Recommended for native UI fidelity):

   ```powershell
   & "$env:LOCALAPPDATA\Programs\exact-extract\exact-extract.exe"
   ```

2. **Or use Dev Server** (Already running):
   - App should be accessible on localhost with native-like Electron frame
   - File dialogs and OS native elements behave the same way

3. **Complete each test in order**, capturing:
   - Screenshots of dialogs and file choosers
   - Notes on button behavior and messages
   - Verification of state changes (unsaved preserved, saved recovered, etc.)

4. **Document results** in this file or a linked test run report

## Notes for Test Operator

- **PDF fixtures:** Use `test-data/fixtures/*.pdf` for import tests
- **Project files:** Saved projects go to a temp or user-chosen directory; note their paths
- **File operations:** Use Windows Explorer or macOS Finder to rename/move files outside the app
- **Keyboard shortcuts:** Cmd+Q (Mac) or Alt+F4 (Windows) closes app; Ctrl+S (both) saves
- **State verification:** After close, reopen and check project's entry count, page thumbnails, and reconciliation stats

## Next Steps

1. **Now:** Execute Tests 1–3 (close dialog paths) – should complete in 10–15 minutes
2. **Then:** Execute Tests 4–5 (relinking) – should complete in 20–30 minutes; requires file operations
3. **Optional:** Execute Test 6 if a natural save failure occurs; otherwise note as "source level tested"
4. **Finally:** Execute Test 7 (export interruption) – should complete in 5–10 minutes

**Estimated Total Time:** 50–90 minutes for full coverage

---

## Sign-Off

| Role          | Date | Status  | Notes                                           |
| ------------- | ---- | ------- | ----------------------------------------------- |
| Test Operator | —    | Pending | Complete tests and update this row              |
| Release Lead  | —    | Pending | Review results and approve B1 native acceptance |
