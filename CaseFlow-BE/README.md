# CaseFlow BE

Backend for CaseFlow, a disciplinary-case-management system for AUCA. Java 21 + Spring Boot 3, Spring Data JPA, PostgreSQL.

This is a new project — there's no prior backend to promote (unlike `CaseFlow-FE`, which was carried over from `CaseFlow-Prototype`). The domain model (`DisciplinaryCase`, `AppUser`, notes, audit trail, appeal/decision lifecycle) mirrors the one in `CaseFlow-FE/src/app/components/mockData.tsx`, and demo data is seeded on first startup (only if the database is empty) so the two projects can be compared side by side. **The frontend now calls this API** (see `CaseFlow-FE/src/lib/api.ts`) instead of using in-memory mock data — enums are serialized as the exact strings the FE already used (`"Under Review"`, `"lecturer"`, etc.) via `@JsonValue`/`@JsonCreator`, and CORS is open for `http://localhost:5173`.

## Getting started

```bash
docker compose up -d     # starts Postgres (CaseFlowDB, :5434) and Mailpit (SMTP catcher)
./mvnw spring-boot:run
```

The API listens on http://localhost:8080. Data is **persistent** — it lives in the `caseflow-postgres-data` Docker volume and survives backend and container restarts; `DataSeeder` only seeds demo data the first time (skipped once the database has any users/cases). To reset back to a clean seeded state, wipe the volume: `docker compose down -v && docker compose up -d`.

Postgres runs on `5434` (not the default `5432`) to avoid clashing with any other local Postgres instance — connection details (db `CaseFlowDB`, user/password `caseflow`/`caseflow`) are in `docker-compose.yml` and must match `application.yml`. These are local-dev-only credentials; externalize them before this goes anywhere near a shared environment.

Tests do **not** need Postgres/Docker running — `./mvnw test` uses an in-memory H2 database configured in `src/test/resources/application.yml`, which overrides the main config on the test classpath.

## Email (SMTP)

Decision notifications ("Student Notified via Email" in the audit trail) send a real email if the student has a matching `AppUser` account — looked up by `studentId`; if there's no match, it's silently skipped (many seeded cases don't have a corresponding demo account, e.g. `CF-2026-002`).

Config is read from environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_AUTH`, `SMTP_STARTTLS`, `SMTP_FROM`), loaded from a `.env` file at the project root via `spring-dotenv` — copy `.env.example` to `.env` and fill in real values for a real provider. `.env` is gitignored; never commit it.

**Local dev needs no setup at all.** With no `.env` present, `application.yml`'s defaults point at the `mailpit` service `docker compose up -d` already started — an unauthenticated local SMTP catcher. Every email the backend sends shows up at **http://localhost:8025**, nothing leaves the machine.

Demo accounts (password `demo1234` for all): `mcuwase@auca.ac.rw` (lecturer), `ekayitesi@auca.ac.rw` (committee), `jbhabimana@student.auca.ac.rw` (student), `amutoni@auca.ac.rw` (admin).

## Scripts

| Command | Description |
| --- | --- |
| `./mvnw spring-boot:run` | Run the API |
| `./mvnw test` | Run tests |
| `./mvnw clean package` | Build a runnable jar into `target/` |

## API overview

| Method & path | Description |
| --- | --- |
| `POST /api/auth/login` | `{ email, password }` → user (401 on failure) |
| `POST /api/auth/register` | Self-register a student account (role forced to `student`) |
| `GET /api/users` | List all users |
| `POST /api/users` | Create a user with any role (admin "create account" flow) |
| `PATCH /api/users/{id}` | Update a user's profile (`name`, `email`, `department`, `studentId`) |
| `PATCH /api/users/{id}/role` | Change a user's role |
| `POST /api/users/{id}/password` | Change password; verifies `currentPassword` first (400 if wrong) |
| `DELETE /api/users/{id}` | Delete a user |
| `GET /api/cases` | List all cases |
| `GET /api/cases/{id}` | Get one case |
| `POST /api/cases` | Report a new incident (lecturer flow) |
| `POST /api/cases/{id}/status` | Update case status directly |
| `POST /api/cases/{id}/notes` | Add a committee deliberation note (auto-transitions `Reported` → `Under Review`) |
| `POST /api/cases/{id}/decision` | Record a committee decision (sets `registrationStatus` to `Restricted` for suspension/expulsion, `Active` otherwise) |
| `POST /api/cases/{id}/appeal` | Submit a student appeal |
| `POST /api/cases/{id}/appeal/resolution` | Resolve an appeal (`Overturned` → case `Resolved` + registration reactivated; `Upheld` → stays `Decided`) |
| `POST /api/cases/{id}/reintegration` | Approve re-integration after a suspension ends (`Resolved` + registration reactivated) |

Passwords are hashed with BCrypt (`spring-security-crypto`); there's no session/token layer yet, so every endpoint is currently open — add real authentication before this goes anywhere near production.

## Architecture

- `domain/` — JPA entities (`AppUser`, `DisciplinaryCase`, `Note`, `AuditEntry`) and enums (`Role`, `CaseStatus`, `DecisionType`, `RegistrationStatus`, `AppealStatus`).
- `repository/` — Spring Data JPA repositories.
- `web/` — REST controllers (`AuthController`, `UserController`, `CaseController`) and their request/response DTOs under `web/dto/`.
- `email/EmailService.java` — thin wrapper over `JavaMailSender`; swallows and logs send failures rather than throwing, so a broken SMTP config never breaks the underlying case/user action.
- `config/DataSeeder.java` — seeds demo users and cases on startup (skipped if the database already has data).
- `docker-compose.yml` — Postgres + Mailpit services used for local dev; not used by tests.
