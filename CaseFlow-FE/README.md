# CaseFlow FE

Frontend for CaseFlow, a disciplinary-case-management system for AUCA. React + TypeScript + Vite, styled with Tailwind CSS v4 and shadcn/ui components.

This app was promoted from `CaseFlow-Prototype` (a Figma Make export) into a standalone, production-tooled project. It now calls the `CaseFlow-BE` REST API (see [`src/lib/api.ts`](src/lib/api.ts)) instead of using in-memory mock data — `CaseFlow-BE` must be running for the app to load anything.

## Getting started

```bash
npm install
npm run dev
```

Start `CaseFlow-BE` first (`../CaseFlow-BE && ./mvnw spring-boot:run`, listening on http://localhost:8080). Then open http://localhost:5173. Demo accounts (password `demo1234` for all) are listed on the login screen — one per role: lecturer, committee member, student, admin.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |

## Environment

Copy `.env.example` to `.env` if `CaseFlow-BE` isn't running on the default `http://localhost:8080/api` — `VITE_API_BASE_URL` in `src/config.ts` falls back to that if unset.

## Architecture

- **No router** — [`src/app/App.tsx`](src/app/App.tsx) fetches `users`/`cases` from the API on mount into React state, then switches on `currentUser.role` to render one of four dashboards: `LecturerDashboard`, `CommitteeDashboard`, `StudentDashboard`, `AdminDashboard`.
- **API client** — [`src/lib/api.ts`](src/lib/api.ts) wraps every `CaseFlow-BE` endpoint, mapping its wire format (numeric user IDs, ISO timestamps, `UNDER_REVIEW`-style enums) to the shapes this app already used with mock data (string IDs, `"YYYY-MM-DD HH:MM"` timestamps, `"Under Review"`-style strings) — no component needed to change its rendering logic.
- **Shared chrome** — [`src/app/components/DashboardLayout.tsx`](src/app/components/DashboardLayout.tsx) provides the sidebar, `PageHeader`, and `StatusBadge` used across all four dashboards.
- **Data model** — [`src/app/components/mockData.tsx`](src/app/components/mockData.tsx) defines `DisciplinaryCase` (with its status/appeal/decision lifecycle) and `AppUser` — despite the filename, it's type definitions only now; the seed data lives in `CaseFlow-BE`'s `DataSeeder`.
- **UI primitives** — [`src/app/components/ui/`](src/app/components/ui/) is a vendored shadcn/ui (Radix + Tailwind) component set; treat it as library code.
