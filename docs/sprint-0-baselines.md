# Sprint 0 baseline evidence

Owner: Agent C

Date captured: 2026-09-12

Command:

```powershell
npm run benchmark:sprint0
```

## Fixture profile

The benchmark combines the representative files listed in [test-data/manifests/sprint-0-fixtures.json](../test-data/manifests/sprint-0-fixtures.json) with a generated large-project profile:

- 2,000 pages
- 2,000 entries
- Parser, OCR, and merged source values
- Keep, Maybe, and Exclude statuses
- Accounting categories, duplicate-candidate tags, payees, source regions, and preflight pages

The large profile is generated at runtime rather than committed as a large binary fixture.

## Baseline measurements

Environment: Windows workspace, Node `v24.18.0`, five iterations per measurement.

| Operation | Median | Target |
| --- | ---: | ---: |
| Review filtering, 2,000 entries | 2.38 ms | < 250 ms |
| Incremental review filtering, 2,000 entries | 108.56 ms | < 250 ms |
| Review navigation, 2,000 entries | 0.11 ms | < 250 ms |
| Financial mapping and stats, 2,000 entries | 40.17 ms | < 250 ms |
| Export preview render plan, 2,000 entries | 14.17 ms | < 500 ms |
| Project save and reopen, 2,000 pages / 2,000 entries | 189.80 ms | < 1,000 ms |
| OCR cancellation and canvas cleanup | 0.33 ms | < 100 ms |

These are medians from five local runs. They are regression baselines and targets, not universal guarantees for every installed machine.

## OCR cancellation scope

The OCR measurement injects rasterization and recognition dependencies. It measures orchestration cancellation, AbortError propagation, and rasterized canvas cleanup without downloading or running a language model. Real OCR quality and packaged OCR behavior remain covered by the existing OCR fixture and packaged verification commands.

## Acceptance

- The benchmark is repeatable through `npm run benchmark:sprint0`.
- Review filtering and navigation remain responsive for the 2,000-entry profile.
- Project save/reopen remains below the one-second target for the generated profile.
- Export preview generation remains below the 500 ms target.
- OCR cancellation remains cancellable and releases rasterized canvas buffers.
- Future Sprint 1-5 work should rerun the benchmark when changing review, persistence, OCR, or export code and record meaningful regressions here.
