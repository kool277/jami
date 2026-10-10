# Scope

- Only change what the task requires
- Aim for long-term maintainability and high-quality code. No dirty hacks or "just get it working" solutions.
- Do not refactor surrounding code unless it directly blocks the task
- Do not add features, flags, or configurability beyond what is asked
- Do not add comments or docstrings to code you did not change

# Tests

- Bug fixes must follow TDD: write a failing regression test first, then fix the code to make it pass
- New features should follow TDD where practical
- Update tests when changing tested logic
- Do not delete tests unless the covered behavior is removed

# Docs

- Update docs when changing public interfaces or user-facing behavior
- Do not update docs for internal refactors

# Validation

- Validate only at system boundaries (user input, external APIs, file I/O)
