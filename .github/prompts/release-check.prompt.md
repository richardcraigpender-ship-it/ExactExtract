---
name: "ExactExtract Release Check"
description: "Run the appropriate ExactExtract quality, OCR, packaging, and Windows acceptance gates for a release or candidate change."
argument-hint: "Describe the release scope or changed area"
agent: "agent"
---
Run a focused release check for the requested scope in this ExactExtract workspace.

1. Read [AGENTS.md](../../AGENTS.md) and identify the owning subsystem and relevant docs.
2. Inspect the current working tree before running commands; do not revert unrelated changes.
3. Run the narrowest relevant test first, then `npm run typecheck`.
4. For packaging or release changes, use the appropriate sequence:
   - `npm run build`
   - `npm run build:win-beta` for a fresh Windows candidate
   - `npm run verify:ocr-package -- dist-windows-beta/win-unpacked/resources/app.asar`
   - `npm run verify:windows-lifecycle`
5. Keep executable results separate from manual boundaries. Do not claim clean-account/VM, human-audible Narrator, or complete installed interactive workflow acceptance unless it was actually performed.
6. Report exact command outcomes, artifact paths and hashes when packaging, remaining warnings, and any tests not run.

Do not commit, create branches, or delete generated artifacts unless explicitly requested.
