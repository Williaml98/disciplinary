# CaseFlow FE

Frontend for CaseFlow, a disciplinary-case-management system for AUCA. React + TypeScript + Vite, styled with Tailwind CSS v4 and shadcn/ui components.

This app was promoted from `CaseFlow-Prototype` (a Figma Make export) into a standalone, production-tooled project. There is no backend yet (`CaseFlow-BE` is still empty), so all data is in-memory mock data seeded in [`src/app/components/mockData.tsx`](src/app/components/mockData.tsx) and lives only for the current browser session.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173. Demo accounts (password `demo1234` for all) are listed on the login screen — one per role: lecturer, committee member, student, admin.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |

## Environment

Copy `.env.example` to `.env` if you need to override `VITE_API_BASE_URL`. It isn't consumed anywhere yet — it's scaffolding for when `CaseFlow-BE` exists.

## Architecture

- **No router** — [`src/app/App.tsx`](src/app/App.tsx) holds `users`/`currentUser`/`cases` in React state and switches on `currentUser.role` to render one of four dashboards: `LecturerDashboard`, `CommitteeDashboard`, `StudentDashboard`, `AdminDashboard`.
- **Shared chrome** — [`src/app/components/DashboardLayout.tsx`](src/app/components/DashboardLayout.tsx) provides the sidebar, `PageHeader`, and `StatusBadge` used across all four dashboards.
- **Data model** — [`src/app/components/mockData.tsx`](src/app/components/mockData.tsx) defines `DisciplinaryCase` (with its status/appeal/decision lifecycle) and `AppUser`, plus the seed data used to initialize state.
- **UI primitives** — [`src/app/components/ui/`](src/app/components/ui/) is a vendored shadcn/ui (Radix + Tailwind) component set; treat it as library code.
