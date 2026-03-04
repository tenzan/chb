# Learning Center

Learning management system for a tutoring center.

## Stack

- **Backend:** Cloudflare Workers + Hono, D1 (SQLite), raw SQL, Zod validation
- **Frontend:** Astro + React + Tailwind, Cloudflare adapter
- **Testing:** Vitest (cloudflare pool for backend, jsdom for frontend), Playwright for E2E
- **Monorepo:** npm workspaces (`backend/`, `frontend/`)

## Commands

```bash
# Backend tests
cd backend && npx vitest run

# Frontend unit tests
cd frontend && npx vitest run

# E2E tests (requires dev servers running)
cd frontend && npx playwright test

# Run a single test file
cd backend && npx vitest run tests/routes/admin-students.test.ts

# Dev servers
npm run dev:backend    # Wrangler dev server
npm run dev:frontend   # Astro dev server

# Database migrations
npm run db:migrate:local   # Apply migrations locally
npm run db:migrate         # Apply migrations remotely (via Doppler)
```

## Development Workflow

### TDD-First Approach (Required)

All features must be implemented using test-driven development on both backend and frontend:

1. **Write failing tests first** — define expected behavior before writing implementation
2. **Write minimal code** to make the tests pass
3. **Refactor** while keeping tests green

This applies to:
- Backend route handlers → tests in `backend/tests/`
- Frontend React components → tests in `frontend/tests/`
- Always run the relevant test suite after implementation to verify

### Backend Conventions

- Response format: `{ data: ... }` on success, `{ error: "..." }` on failure
- IDs: `crypto.randomUUID()` as TEXT columns
- Auth: PBKDF2 password hashing, session tokens (raw in cookie, SHA-256 hash in DB)
- RBAC: Multiple roles per user via `user_roles` junction table (Admin, Personnel, Tutor, Accountant, Parent)
- Bootstrap: Auto-creates admin user from env vars on first request
- Tests use `cloudflare:test` with `applyMigrations()`, `clearTables()`, `seedRoles()` helpers
- Migrations are sequential SQL files in `backend/migrations/`

### Frontend Conventions

- React components live in `frontend/src/components/react/`
- Tests use `@testing-library/react` with `vitest` and `jsdom`
- Mocking: `vi.spyOn(globalThis, "fetch")` for API calls in tests
- API base URL via `getApiUrl()` from `src/lib/config.ts`
- All API calls use `credentials: "include"` for cookie-based auth
