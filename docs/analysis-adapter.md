# Analysis adapter

The Analysis engine is framework-independent and lives under `src/analysis`.

## Shared-entry mapping

`projectEntryToAnalysisEntry` maps frozen `ProjectEntry` fields as follows:

| ProjectEntry                               | AnalysisEntry  |
| ------------------------------------------ | -------------- |
| `id`                                       | `id`           |
| `status`                                   | `status`       |
| `numericValue`, otherwise `normalizedText` | `value`        |
| `normalizedText`                           | `label`        |
| `date`                                     | `date`         |
| `category`                                 | `category`     |
| `confidence`                               | `confidence`   |
| normalized reviewed text                   | `duplicateKey` |
| `status === maybe` or `uncertain` tag      | `uncertain`    |
| `outlier` tag                              | `outlier`      |

The adapter sorts by entry ID and does not mutate source entries.

## Kept-only invariant

`projectKeptDataset` includes only entries with `status === 'keep'`. Maybe and excluded IDs are reported separately and never contribute to default metrics or totals mismatch calculations.

## UI integration

`AnalysisPanel` accepts real `ProjectEntry[]` and optionally a precomputed `AnalysisSnapshot`. It owns no project state and persists nothing. Integration should pass an entry-navigation callback that selects the affected Review entry and its PDF region.

Analysis snapshots are plain JSON-safe data with schema version `1`, deterministic definitions/results/issues, and contributor IDs.
