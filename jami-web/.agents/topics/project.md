# Layout

npm workspaces monorepo (Node ≥ 22):

- `client/` — React + Vite + MUI frontend
- `server/` — Express backend (bridges to the Jami daemon)
- `common/` — shared TypeScript types/utils, built first
- `tests/` — Playwright end-to-end tests (config: `playwright.config.ts`)

# Commands

- Build: `npm run build` (all workspaces)
- Dev servers: `npm start` (client on :3000, server on :8080)
- Lint: `npm run lint` / `npm run lint:fix`
- Format: `npm run format`
- E2E tests: `npx playwright test`
- Server unit tests: `npm run test:unit --workspace server`
