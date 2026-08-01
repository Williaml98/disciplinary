# CaseFlow BE

Backend for CaseFlow, a disciplinary-case-management system for AUCA. Java 21 + Spring Boot 3, Spring Data JPA, PostgreSQL.

This is a new project — there's no prior backend to promote (unlike `CaseFlow-FE`, which was carried over from `CaseFlow-Prototype`). The domain model (`DisciplinaryCase`, `AppUser`, notes, audit trail, appeal/decision lifecycle) mirrors the one in `CaseFlow-FE/src/app/components/mockData.tsx`. **The frontend calls this API** (see `CaseFlow-FE/src/lib/api.ts`) instead of using in-memory mock data — enums are serialized as the exact strings the FE already used (`"Under Review"`, `"lecturer"`, etc.) via `@JsonValue`/`@JsonCreator`, and CORS is open for `http://localhost:5173`.

The database starts **completely empty** — there is no seed/demo data anywhere in this project. Every user and case is created through real usage of the app. `POST /api/users` is unauthenticated **only while the database has zero users** — the very first account (typically an admin) has to be created that way (e.g. with `curl`), since there's no other login-gated way to create it. The moment any user exists, that same endpoint requires an admin's token; after bootstrapping, an admin creates further accounts from the FE's Admin dashboard, and students can self-register via `POST /api/auth/register`.

## Getting started

```bash
docker compose up -d     # starts Postgres (CaseFlowDB, :5434) and Mailpit (SMTP catcher)
./mvnw spring-boot:run
```

The API listens on http://localhost:8080. Data is **persistent** — it lives in the `caseflow-postgres-data` Docker volume and survives backend and container restarts. There's no seeding of any kind; a fresh volume means a genuinely empty database (see above for how to create the first user). To wipe everything and start over from empty: `docker compose down -v && docker compose up -d`.

Postgres runs on `5434` (not the default `5432`) to avoid clashing with any other local Postgres instance — connection details (db `CaseFlowDB`, user/password `caseflow`/`caseflow`) are in `docker-compose.yml` and must match `application.yml`. These are local-dev-only credentials; externalize them before this goes anywhere near a shared environment.

Tests do **not** need Postgres/Docker running — `./mvnw test` uses an in-memory H2 database configured in `src/test/resources/application.yml`, which overrides the main config on the test classpath.

## Authentication

Stateless JWT bearer tokens via Spring Security — no server-side session store. `POST /api/auth/login` and `POST /api/auth/register` return `{ token, user }`; every other endpoint (except the bootstrap window on `POST /api/users` and evidence-photo downloads, see below) requires `Authorization: Bearer <token>`. `GET /api/auth/me` returns the caller's own current record, used by the FE to restore a session from a stored token without re-authenticating.

- **Token lifetime**: 12 hours normally, 30 days if `remember: true` was passed to `/auth/login` — both configurable via `JWT_EXPIRATION_MINUTES`/`JWT_REMEMBER_EXPIRATION_MINUTES` in `.env`. A dev-only default `JWT_SECRET` is baked into `application.yml` so this needs zero setup locally; generate and set a real one (`openssl rand -base64 48`) before this goes anywhere beyond your machine.
- **Role checks** live as `@PreAuthorize` annotations directly on each `CaseController`/`UserController` method — e.g. only `COMMITTEE` can record a decision, only `LECTURER`/`ADMIN` can report an incident, only `ADMIN` can list/delete users. A `STUDENT` caller additionally only ever sees their own case(s) from `GET /api/cases`/`GET /api/cases/{id}` — enforced server-side in `CaseController`, not just hidden in the FE.
- **Evidence photo downloads** (`GET /api/cases/{id}/evidence/{filename}`) are deliberately left unauthenticated — plain `<img>` tags can't send an `Authorization` header, and the filenames are already server-generated UUIDs, so this is "unlisted URL" protection rather than open browsing.
- **Ownership checks**: `PATCH /api/users/{id}` and `POST /api/users/{id}/password` require the caller to either be that user or an admin.

## Email (SMTP)

Three case actions send a real email, each logged as "Student Notified via Email" in the audit trail: `POST /api/cases/{id}/decision` (decision recorded), `POST /api/cases/{id}/appeal/resolution` (appeal outcome), and `POST /api/cases/{id}/reintegration` (re-integration approved). All three look the student up by `studentId` against `AppUser`; if there's no match, sending is silently skipped.

Config is read from environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_AUTH`, `SMTP_STARTTLS`, `SMTP_FROM`), loaded from a `.env` file at the project root via `spring-dotenv` — copy `.env.example` to `.env` and fill in real values for a real provider. `.env` is gitignored; never commit it.

**Local dev needs no setup at all.** With no `.env` present, `application.yml`'s defaults point at the `mailpit` service `docker compose up -d` already started — an unauthenticated local SMTP catcher. Every email the backend sends shows up at **http://localhost:8025**, nothing leaves the machine.

## Scripts

| Command | Description |
| --- | --- |
| `./mvnw spring-boot:run` | Run the API |
| `./mvnw test` | Run tests |
| `./mvnw clean package` | Build a runnable jar into `target/` |

## API overview

| Method & path | Auth | Description |
| --- | --- | --- |
| `POST /api/auth/login` | Open | `{ email, password, remember }` → `{ token, user }` (401 on failure) |
| `POST /api/auth/register` | Open | Self-register a student account (role forced to `student`) → `{ token, user }` |
| `GET /api/auth/me` | Any | Returns the caller's own current user record |
| `GET /api/users` | Admin | List all users |
| `POST /api/users` | Open until 1st user exists, then Admin | Create a user with any role (admin "create account" flow) |
| `PATCH /api/users/{id}` | Self or Admin | Update a user's profile (`name`, `email`, `department`, `studentId`) |
| `PATCH /api/users/{id}/role` | Admin | Change a user's role |
| `POST /api/users/{id}/password` | Self or Admin | Change password; verifies `currentPassword` first (400 if wrong) |
| `DELETE /api/users/{id}` | Admin | Delete a user |
| `GET /api/cases` | Any (Student sees only their own) | List cases |
| `GET /api/cases/{id}` | Any (Student: own case only) | Get one case |
| `POST /api/cases` | Lecturer/Admin | Report a new incident |
| `POST /api/cases/{id}/evidence` | Lecturer/Admin | Upload one or more evidence photos (`multipart/form-data`, field `files`; JPEG/PNG/GIF/WEBP only, 8MB/file) |
| `GET /api/cases/{id}/evidence/{filename}` | Open | Fetch a stored evidence photo (see "Authentication" above) |
| `POST /api/cases/{id}/status` | Committee/Admin | Update case status directly |
| `POST /api/cases/{id}/notes` | Committee | Add a deliberation note (auto-transitions `Reported` → `Under Review`) |
| `POST /api/cases/{id}/decision` | Committee | Record a decision (sets `registrationStatus` to `Restricted` for suspension/expulsion, `Active` otherwise) |
| `POST /api/cases/{id}/appeal` | Student (own case) | Submit an appeal |
| `POST /api/cases/{id}/appeal/resolution` | Committee | Resolve an appeal (`Overturned` → case `Resolved` + registration reactivated; `Upheld` → stays `Decided`); emails the student |
| `POST /api/cases/{id}/reintegration` | Committee | Approve re-integration after a suspension ends (`Resolved` + registration reactivated); emails the student |

Passwords are hashed with BCrypt.

## Architecture

- `domain/` — JPA entities (`AppUser`, `DisciplinaryCase`, `Note`, `AuditEntry`) and enums (`Role`, `CaseStatus`, `DecisionType`, `RegistrationStatus`, `AppealStatus`).
- `repository/` — Spring Data JPA repositories.
- `security/` — `JwtService` (sign/parse tokens), `JwtAuthenticationFilter` (reads the `Authorization` header, populates `SecurityContextHolder`), `SecurityConfig` (`SecurityFilterChain`, CORS, permitAll rules), `AuthenticatedUser` (the `@AuthenticationPrincipal` type — id/email/role/studentId, trusted straight from the token's claims with no DB round-trip per request).
- `web/` — REST controllers (`AuthController`, `UserController`, `CaseController`) and their request/response DTOs under `web/dto/`.
- `email/EmailService.java` — thin wrapper over `JavaMailSender`; swallows and logs send failures rather than throwing, so a broken SMTP config never breaks the underlying case/user action.
- `storage/EvidenceStorage.java` — stores uploaded evidence photos on the local filesystem under `caseflow.uploads.dir` (default `./uploads/{caseId}/{uuid}.{ext}`, gitignored). Filenames are always server-generated from a UUID plus an extension derived from the validated content type — neither upload nor download ever trusts a client-supplied filename or path segment.
- `docker-compose.yml` — Postgres + Mailpit services used for local dev; not used by tests.
