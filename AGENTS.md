# Repository instructions for every developer and coding assistant

## First project-context document

**Read `Checkpoint/HANDOVER.md` before starting any work.** This applies to Codex/ChatGPT, Claude Code, Kimi and any future developer, including when the same tool returns the next day. It contains current state, user decisions, work already completed and the next step.

Then inspect current Git and read `CLAUDE.md` plus relevant component instructions. Do not discard another developer's local changes. Treat the latest user instruction as authoritative; a pending handover item does not itself authorize implementing it.

## Required handoff before ending a session

- Update the current-state sections of `Checkpoint/HANDOVER.md` with what actually changed, what shipped, remaining problems and the next concrete action.
- Append a session-log entry with local date/time/timezone, developer/tool, request, changes, commit/PR references, validation and its limits, release/deployment status and unfinished work.
- Commit the handover together with the related changes. For blocked or incomplete work, state that explicitly. Never claim unrun tests or unpublished releases.
- Keep this single canonical filename. Do not create per-tool or daily handover files. Git preserves history.
- Keep credentials, signing keys, tokens, raw patient reports, patient identifiers and raw sensitive logs out of the handover.

For concurrent work, use separate branches/worktrees, avoid overlapping scope unless agreed, and reconcile the handover against latest main when merging. Preserve all developers' log entries. The protocol is recorded in the repository; tools that do not load repository instructions automatically must be explicitly directed to read this file and the handover.

Project engineering conventions remain in `CLAUDE.md` and applicable component files. `Checkpoint/` is the user-approved location for the shared handover even though other project documentation lives under `docs/`.
