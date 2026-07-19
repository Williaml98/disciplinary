# CaseFlow BE

Backend for CaseFlow, a disciplinary-case-management system for AUCA. Java 21 + Spring Boot 3, Spring Data JPA, H2 in-memory database.

This is a new project — there's no prior backend to promote (unlike `CaseFlow-FE`, which was carried over from `CaseFlow-Prototype`). The domain model (`DisciplinaryCase`, `AppUser`, notes, audit trail, appeal/decision lifecycle) mirrors the one in `CaseFlow-FE/src/app/components/mockData.tsx`, and demo data is seeded on startup so the two projects can be compared side by side. **The frontend is not wired up to this API yet** — it still runs entirely on its own in-memory mock data.

## Getting started

```bash
./mvnw spring-boot:run
```

The API listens on http://localhost:8080. It reseeds an in-memory H2 database on every restart (data does not persist). An H2 console is available at http://localhost:8080/h2-console (JDBC URL `jdbc:h2:mem:caseflow`, user `sa`, empty password).

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
| `POST /api/auth/login` | `{ email, password }` → user (404/401 on failure) |
| `POST /api/auth/register` | Self-register a student account |
| `GET /api/users` | List all users |
| `GET /api/cases` | List all cases |
| `GET /api/cases/{id}` | Get one case |
| `POST /api/cases` | Report a new incident (lecturer flow) |
| `POST /api/cases/{id}/status` | Update case status |
| `POST /api/cases/{id}/notes` | Add a committee deliberation note |
| `POST /api/cases/{id}/decision` | Record a committee decision |
| `POST /api/cases/{id}/appeal` | Submit a student appeal |
| `POST /api/cases/{id}/appeal/resolution` | Resolve an appeal |

Passwords are hashed with BCrypt (`spring-security-crypto`); there's no session/token layer yet, so every endpoint is currently open — add real authentication before this goes anywhere near production.

## Architecture

- `domain/` — JPA entities (`AppUser`, `DisciplinaryCase`, `Note`, `AuditEntry`) and enums (`Role`, `CaseStatus`, `DecisionType`, `RegistrationStatus`, `AppealStatus`).
- `repository/` — Spring Data JPA repositories.
- `web/` — REST controllers (`AuthController`, `UserController`, `CaseController`) and their request/response DTOs under `web/dto/`.
- `config/DataSeeder.java` — seeds demo users and cases on startup (skipped if the database already has data).
