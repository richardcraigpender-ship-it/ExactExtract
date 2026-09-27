---
description: "Use when writing, running, or reviewing tests, lint, typecheck, build, OCR verification, or release gates in ExactExtract."
name: "ExactExtract Testing"
applyTo: ["**/*.test.ts", "**/*.test.tsx", "package.json", "scripts/**/*.{mjs,ps1,ts}"]
---
# Testing Guidelines

- Start with the narrowest behavior-scoped test, then run `npm run typecheck`; widen only when the result supports it.
- Use fresh command invocations and capture long output to a temporary file when needed. Do not infer success from stale terminal scrollback, an old background process, or a partial output file.
- Report the command exit code and the final test counts. For failures, include the test name and file before changing code.
- Keep `npm test` serial: `--test-concurrency=1` is intentional for Windows stability.
- Test live in-memory state separately from save/reload state when changing persistence, derived reports, review queues, merchant rules, or export configuration.
- For renderer changes, test accessible names/states, focus behavior, responsive overflow, and both preview and final-output behavior where relevant.
- For OCR changes, preserve cancellation and cleanup assertions; use deterministic injected dependencies for orchestration tests and packaged checks for asset verification.
- Do not “fix” unrelated lint warnings or tests from another owned subsystem. Record unrelated failures separately and keep the touched-slice validation trustworthy.
- See [docs/sprint-0-baselines.md](../../docs/sprint-0-baselines.md) for performance targets and [docs/release-readiness.md](../../docs/release-readiness.md) for release gates.
