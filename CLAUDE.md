# Learning Center

Learning management system for a tutoring center.

## Stack

- **Runtime:** Astro SSR + Cloudflare Pages, D1 (SQLite), raw SQL, Zod validation
- **Frontend:** React + Tailwind (inside Astro)
- **Testing:** Vitest (Miniflare for API tests, jsdom for component tests), Playwright for E2E
- **Auth:** PBKDF2 password hashing, session tokens (raw in cookie, SHA-256 hash in DB)

## Commands

```bash
# Run all unit/integration tests
npm test

# Run a single test file
npx vitest run tests/api/auth.test.ts

# E2E tests (requires dev server running)
npm run test:e2e

# Dev server
npm run dev

# Build
npm run build

# Database migrations
npm run db:migrate:local   # Apply migrations locally
npm run db:migrate         # Apply migrations remotely
```

## Project Structure

```
src/
  middleware.ts          # Auth, bootstrap, security headers
  lib/                   # Shared: db, session, crypto, password, rbac, validation, types
  pages/
    api/                 # API routes (Astro APIRoute handlers)
      auth/              # login, logout, me
      admin/             # users, invites, parents, students, deployments
    admin/               # Admin pages (.astro)
  components/react/      # React components
  layouts/               # DashboardLayout, PublicLayout
tests/
  setup/                 # test-env (Miniflare), mock-context, seed helpers
  api/                   # API route tests
  lib/                   # Library tests
  components/            # React component tests (jsdom)
  e2e/                   # Playwright E2E tests
migrations/              # D1 SQL migrations
```

## Development Workflow

### TDD-First Approach (Required)

1. **Write failing tests first** — define expected behavior before writing implementation
2. **Write minimal code** to make the tests pass
3. **Refactor** while keeping tests green

### Conventions

- Response format: `{ data: ... }` on success, `{ error: "..." }` on failure
- IDs: `crypto.randomUUID()` as TEXT columns
- RBAC: Multiple roles per user via `user_roles` junction table (Admin, Personnel, Tutor, Accountant, Parent)
- DB access: `getDB(locals)` / `getEnv(locals)` from `src/lib/db.ts`
- Role checks: `hasRole(locals.user!, 'Admin')` inline in route handlers
- Bootstrap: Auto-creates admin user from env vars on first request (via middleware)
- API routes are Astro `APIRoute` exports (GET, POST, PATCH, DELETE)
- Tests call route handler functions directly with `createMockAPIContext()`
- Component tests use `// @vitest-environment jsdom` comment
- All API calls from React components use relative URLs (no cross-origin)
