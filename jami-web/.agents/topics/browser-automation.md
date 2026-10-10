# Playwright MCP order of operations

1. **Setup the page context** — call `planner_setup_page` (or the generator
   equivalent) with a `seedFile` and `project` before any browser interaction.
2. **Navigate with `browser_navigate`** — with both `url` and `intent`
   parameters.
3. Explore the browser snapshot. All browser interaction tools
   (`browser_click`, `browser_snapshot`, `browser_take_screenshot`, etc.) are
   available. Prefer `browser_snapshot` to understand the page structure
   before taking any action. Use screenshots only as a last resort.

# UI changes

- Have the user validate UI changes in a browser before completing.
- Run the full test suite at the end, before committing.
