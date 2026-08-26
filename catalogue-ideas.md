# Catalogue Ideas

A living product and engineering note for a local library of unique extracted descriptions and reusable coding rules in EXACT EXTRACT.

Created: 2026-08-22
Status: Discovery and design; no catalogue implementation has started.

## The core idea

When a document contains a description column, keep each extracted description as part of the source-linked project entry and also offer it as a reusable catalogue item.

The catalogue is separate from the project. A project preserves what the document actually said. The catalogue remembers reusable knowledge learned or confirmed by the user.

Example:

```text
Source description: Direct Debit - Electricity
Catalogue item:   Direct Debit - Electricity
Code:             UTIL-ELECTRIC
Category:         Utilities
Default role:     Money out
Occurrences:      17
```

The catalogue should support later instant recognition, repeat-input coding, cleaner analytics, and less repetitive review work without silently rewriting source data.

## Current document example

The current financial workflow can detect aligned table rows and can map amount positions to roles such as:

- Money out
- Money in
- Balance
- Ignore

The current financial mapping also derives a description from the text before the detected amount values. That description should become an explicit first-class field, rather than being reconstructed whenever a report needs it.

For this example, the useful statistics are not simply the sum of every balance snapshot. A balance is normally a state at a point in time, so the meaningful calculations are:

- Money-in total
- Money-out total
- Net movement
- Opening balance
- Closing balance
- Lowest and highest balance
- Monthly counts and movements
- Reconciliation between calculated and statement closing balances

The central formula is:

```text
calculated closing balance = opening balance + total money in - total money out
```

Then:

```text
difference = calculated closing balance - statement closing balance
```

A balance column should default to `last value` or `first/last by time`, not `sum`. A sum of balance snapshots may be offered only as an explicitly labelled advanced operation.

The analytics page should eventually show two clearly separated datasets:

- **All extracted:** every valid source row, with invalid, duplicate, header, subtotal, and total rows explained separately.
- **Kept entries:** the same calculations restricted to rows the user marked Keep.

Both views should include month-by-month results, such as March, April, May, and July, plus whole-document totals.

## Immediate smaller-scale feature

The near-term priority is the current document's financial analysis, not the full catalogue system.
The first useful slice should:

- Show an **All extracted** dataset and a **Kept entries** dataset.
- Group mappable rows by their detected date month, including March, April, May, and July when present.
- Show money-in, money-out, and net movement totals for the whole document and each month.
- Show the total of all Balance-column snapshots for the whole document, explicitly labelled as a snapshot sum.
- Show the first/opening balance, final/closing balance, calculated closing balance, and reconciliation difference.
- Report rows that could not be mapped instead of silently dropping them.
- Preserve the non-personal business description as a `payee` field on the extracted project entry.

The Balance-column snapshot sum is included because it is useful for inspection and was requested for
this document, but it must not be confused with an account balance. The account balance is represented
by the chronological first and last snapshots, while the calculated close is derived from money in and
money out. The full catalogue, fuzzy recognition, reusable coding rules, and cross-project library remain
background work until this focused analysis slice is dependable.

## Catalogue principles

### Preserve source truth

The original extracted text, original row, source location, amount, and extraction confidence must remain available. Catalogue matching is an interpretation layered on top of the source, never a replacement for it.

### Recognition is not correction

A match can suggest a catalogue item. It must not silently alter the source description, amount, date, or status.

### Exact before fuzzy

Use this order:

1. Exact normalized match.
2. Previously confirmed alias match.
3. Fuzzy suggestion requiring confirmation.
4. New catalogue item.

Fuzzy matching should initially be assistive only. The user confirms the relationship before it becomes a reusable alias or rule.

### Every result is explainable

A user should be able to open a metric or coding decision and see:

- Which source rows contributed.
- Which rows were excluded and why.
- The original extracted value.
- The normalized value used in calculation.
- The catalogue match and confidence.
- Any manual correction and its history.

### Local first

The catalogue should work offline and stay on the user's device. It should not require an account or cloud service.

## Proposed catalogue record

A first version could use this conceptual shape:

```text
CatalogueItem
- id
- canonicalDescription
- normalizedKey
- aliases[]
- code?
- category?
- defaultRole?
- defaultIncludeInReports
- notes?
- occurrenceCount
- firstSeenAt
- lastSeenAt
- sourceProjectIds[] or provenance summary
- confidence
- createdAt
- updatedAt
```

A later version can separate this into related records:

```text
CatalogueItem
CatalogueAlias
CatalogueRule
CatalogueObservation
CatalogueCorrection
```

Useful rule fields might include:

```text
CatalogueRule
- id
- catalogueItemId
- matchType: exact | alias | pattern
- pattern?
- category?
- code?
- amountRole?: money-in | money-out | balance | ignore
- taxTreatment?
- includeInReports?: boolean
- priority
- requiresConfirmation
- createdAt
- updatedAt
```

The catalogue should store normalized keys for matching, but should also retain the human-readable canonical description and aliases.

## Description normalization

Normalization should remove harmless variation without destroying meaning:

- Unicode normalization.
- Whitespace collapsing.
- Case folding for matching.
- Carefully standardized punctuation.
- Optional bank-specific prefixes only through explicit rules.

Do not remove meaningful numbers, account references, invoice identifiers, or dates by default. Normalization must be conservative and testable.

Examples that may be suggested as related:

```text
Direct Debit - Electricity
Direct Debit Electricity
DD ELECTRICITY
```

These should not become the same catalogue item automatically until the user confirms the relationship.

## Repeat-input coding

After a catalogue item is confirmed, it can provide defaults for future documents:

- Clean display description.
- Category.
- User-defined accounting code.
- Money-in or money-out role.
- Tax or VAT treatment.
- Include/exclude from reports.
- Default tags.
- Project-specific overrides.

A future extraction flow could show:

```text
New extracted description
        |
        v
Exact or confirmed catalogue match
        |
        v
Suggested category and coding
        |
        v
User confirms, edits, or rejects
        |
        v
Catalogue rule becomes stronger for future use
```

A rejected suggestion should be recorded so the same bad suggestion is not repeatedly offered.

## Financial analytics built on the catalogue

For the current bank-statement-style document, the catalogue can make reports more useful without owning the arithmetic.

Possible views:

- All extracted by month.
- Kept entries by month.
- Money in by catalogue item.
- Money out by catalogue item.
- Net movement by category.
- Recurring descriptions.
- New or unrecognized descriptions.
- Rows with conflicting coding.
- Rows that caused reconciliation differences.

Example:

```text
Utilities
March       120.40
April        98.10
May         115.75
July        102.20
Whole period 436.45
```

Every total should be expandable to the exact contributing entries.

## Safe calculations and financial controls

The calculation layer should:

- Separate money-in, money-out, and balance roles.
- Treat balance as a state, not a transaction amount.
- Exclude headers, subtotals, and statement totals from transaction sums.
- Detect and explain invalid or missing values.
- Handle parentheses, debit/credit markers, currency symbols, decimal separators, and negative signs.
- Warn about mixed currencies.
- Use integer minor units such as pence/cents where practical, or apply deliberate decimal arithmetic and rounding rules.
- Preserve the original text beside every normalized number.
- Show a completeness indicator.
- Show the exact rows contributing to each number.
- Allow manual corrections with original value, replacement value, reason, user, and timestamp.
- Recalculate the projected closing balance after edits.
- Show reconciliation failure as a warning or error, never as a reassuring total.

A useful summary could look like:

```text
All extracted
Rows: 184
Valid transaction rows: 179
Excluded headers/totals: 5
Money in: £12,430.00
Money out: £10,215.50
Net movement: £2,214.50
Opening balance: £4,800.00
Calculated closing balance: £7,014.50
Statement closing balance: £7,014.50
Difference: £0.00
Status: Reconciled
```

## Universal model

The catalogue should not be limited to accounting descriptions. The reusable concept is:

- **Dimensions:** how data is grouped, such as month, student, campaign, account, product, or vehicle.
- **Measures:** values, such as money, hours, days, marks, visits, quantity, or distance.
- **Roles:** what a value means, such as inflow, outflow, balance, score, duration, count, or percentage.
- **Operations:** how to summarize it, such as sum, average, median, minimum, maximum, rate, change, or last value.

Examples:

### Time records

- Total hours by person or month.
- Billable versus non-billable hours.
- Average duration.
- Earliest start and latest finish.
- Days worked.
- Missing, overlapping, or implausible entries.

### Student marks

- Raw score and maximum score kept separately.
- Percentage achieved.
- Average, median, range, and pass rate.
- Progress over time.
- Results by student, subject, class, or assessment.

Do not sum raw marks across assessments with different maximum scores unless the user explicitly chooses a weighted or total-score calculation.

### Website traffic

- Visits by day or month.
- Unique users.
- Conversion rate.
- Average session duration.
- Traffic by source or campaign.
- Period-over-period growth.

Do not sum unique users across periods without warning, because one user can appear in multiple periods.

### Inventory and operations

- Quantity received.
- Quantity sold.
- Current stock.
- Reorder threshold.
- Stock movement by period.
- Expected versus observed stock.

The same safety model applies: identify the measure and its aggregation semantics before calculating.

## Storage proposal

### Version 1: separate local JSON catalogue

The app currently persists projects through the Electron main process. A first catalogue can follow that established architecture:

- Store a separate catalogue file in Electron's user-data directory.
- Expose typed operations through `window.studio` and preload IPC.
- Validate the catalogue schema on read.
- Write atomically through a temporary file and rename.
- Keep catalogue data separate from project JSON.
- Provide catalogue export/import for backup.

This is the smallest change and avoids adding a database dependency while the model is still evolving.

### Version 2: SQLite when the need is proven

Move to SQLite when the catalogue needs:

- Many thousands of items.
- Indexed fuzzy search.
- Multiple related rule and observation tables.
- Rich correction history.
- Fast filtering across projects.
- More sophisticated migrations or concurrent access.

The domain interfaces should be designed so the storage implementation can change from JSON to SQLite without changing the renderer's conceptual API.

## Suggested user experience

### Catalogue panel

A dedicated panel could show:

- Search box.
- Canonical description.
- Aliases.
- Category and code.
- Usage count.
- Last seen.
- Confidence.
- Source documents.
- Edit and merge actions.

### During review

Each extracted description could show a compact status:

- Matched.
- Suggested match.
- New description.
- Conflicting rule.
- Needs confirmation.

The user should be able to accept a suggestion, create a new item, ignore the catalogue for this row, or create a project-specific override.

### During analytics

Reports should support:

- All extracted versus kept entries.
- Month, quarter, or custom date grouping.
- Catalogue item and category grouping.
- Column-specific measures.
- Reconciliation status.
- Expandable contributing rows.
- Export of both results and calculation provenance.

## Background sprint proposal

This work can progress slowly beside app polish. It should begin with pure data contracts and tests, then add UI only when the contracts are stable.

### Sprint: Description Catalogue Foundation

**Goal:** preserve descriptions explicitly and create a safe local catalogue that can recognize exact repeated descriptions without changing source data.

**Wave 1: Source and model foundation**

- Add an explicit description field or a clearly named derived description contract to projected entries.
- Define `CatalogueItem`, alias, provenance, and rule types.
- Define normalization and exact-match behavior.
- Add schema validation and migration strategy.
- Decide whether source descriptions are copied at projection time or derived from table cells through a shared table-row model.

**Wave 2: Local persistence**

- Add a main-process catalogue store beside the project store.
- Use atomic writes and defensive reads.
- Add typed preload IPC for list, search, upsert, and delete/merge operations.
- Add import/export backup.
- Add focused store tests, including malformed-file recovery.

**Wave 3: Recognition during review**

- Build exact normalized matching.
- Show matched, new, and confirmation-needed states.
- Add explicit user confirmation for aliases.
- Record rejected suggestions.
- Never change source text automatically.

**Wave 4: Repeat coding**

- Add category, code, amount role, tags, and report-inclusion defaults.
- Apply confirmed defaults as suggestions to new entries.
- Support project-specific overrides.
- Add audit events for accepted, rejected, edited, and removed rules.

**Wave 5: Column-aware analytics**

- Preserve table cells and column identities.
- Let users confirm column names and roles.
- Add All extracted and Kept entries datasets.
- Add month-by-month money-in, money-out, net movement, and closing balance views.
- Add expandable contributing rows and reconciliation diagnostics.
- Connect catalogue categories/codes to grouped reports.

**Exit gate:** a repeated description can be recognized locally, a user can confirm a coding rule, the rule can be applied as a visible suggestion to a later document, and every resulting statistic remains traceable to source rows.

## Immediate next steps

1. Keep this document as the product/design source of truth while the current export-preview and app-polish work continues.
2. Add a first-class, tested description extraction contract for the current table/financial path.
3. Build a pure normalization and exact-match module before adding UI or fuzzy matching.
4. Add catalogue persistence only after the model and migration behavior are tested.
5. Improve the stats page around the current document first: named columns, All extracted/Kept entries, month grouping, money-in/out totals, and balance reconciliation.
6. Add fuzzy matching and universal dataset types only after the financial workflow is auditable and dependable.

## Open design questions

- Should the catalogue be global to the installation, or optionally scoped by user/project/company?
- How should two descriptions with the same normalized key but different currencies or accounts be separated?
- Which accounting and tax fields belong in the first release, and which should remain user-defined metadata?
- How should merged catalogue items preserve their history?
- Should a user be able to bulk-confirm repeated suggestions?
- How much fuzzy matching is useful before it becomes difficult to trust?
- Should table cells become a new shared extraction model, or should the catalogue initially consume projected descriptions only?

## Guiding principle

The catalogue should make repeated work feel lighter while making the evidence behind every decision easier to inspect. Automation earns permission through confirmed patterns; it does not earn permission by hiding uncertainty.
