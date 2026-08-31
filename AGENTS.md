## Agent skills

## Configuration and flow changes

- Reuse the existing configuration value and established flow before introducing a new delay, cooldown, gate, retry, or fallback.
- Do not add a hard-coded timing/value, hidden wait, or parallel control flow without the user's explicit approval.
- When an existing setting controls the behavior, it remains the single source of truth; surface any needed new behavior through that setting or obtain approval for a new user-visible setting first.

### Issue tracker

Issues and specs are local Markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five canonical labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
