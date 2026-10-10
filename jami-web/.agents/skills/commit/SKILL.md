---
name: commit
description: Commit changes to the repository
---

# Grouping

Check `git diff` and `git diff --staged` before writing a message.
One commit per logical unit of work.

# Message format

`topic: subject` — conventional commits

- Subject ≤50 chars
- Body lines ≤72 chars, blank line between subject and body
- Body is optional; skip it when the subject already says everything needed
- Keep the body succinct — no dissertations

# Formatting

The pre-commit hook (`.hooks/pre-commit`) runs lint-staged (eslint --fix +
prettier) on staged files. If it fails, fix the reported issues and re-stage;
do not bypass it with `--no-verify`.
