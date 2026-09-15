# DE-SCHOOL — Backend

![CI](https://github.com/DE-SCHOOL/school-backend/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

The API behind DE-SCHOOL: a multi-tenant school management platform for
Cameroonian secondary and higher-education institutions, with tuition,
subscription, and canteen payments settled over the [Stellar
network](https://stellar.org).

This is the backend only. The staff/student dashboard, the public
website, and the platform console that pairs with this API live in
[`school-frontend`](https://github.com/DE-SCHOOL/school-frontend).

## What DE-SCHOOL is

Most schools in Cameroon run their administration on paper registers and
scattered spreadsheets: matricule numbers assigned by hand, continuous
assessment and exam scores compiled at term's end into a mark sheet
someone has to re-type, fees collected in cash or by bank transfer with
no reliable way to reconcile who has actually paid. DE-SCHOOL replaces
that with one system, built around how these institutions actually
work — CA/exam weighting, resit lists, matricule-based student records,
role-based staff access (lecturer, secretariat, HOD, director, admin) —
not a generic school-management template adapted after the fact.

It is **multi-tenant**: every school that joins gets its own isolated
workspace on the same platform, enforced at the database layer (see
[Multi-tenancy](#multi-tenancy--security)), not just hidden behind a
login screen. A student enrolled at more than one DE-SCHOOL institution
keeps a single identity across all of them.

Payments — tuition invoices, platform subscriptions, canteen top-ups —
settle in USDC over the **Stellar network**, typically in seconds, with
an optional fully on-chain billing record ([`contracts/`](contracts/))
a school's proprietor or board can audit directly. This is the
platform's flagship differentiator and the reason it is being built
toward a submission in the Stellar ecosystem's contributor and grant
programs (Drips Wave / GrantFox / the Stellar Community Fund — see
`my-todo.md`'s Stage 12 in the project root for which is actually being
pursued).

## Architecture at a glance

- **Stack:** Node.js 22, Express 5, Mongoose 9, MongoDB. Plain
  JavaScript (CommonJS), no TypeScript, no ORM migration framework.
- **Multi-tenancy:** a Mongoose plugin
  (`utilities/tenantScope.plugin.js`) auto-scopes every query on every
  school-owned model to the authenticated caller's `schoolId`, backed by
  Node's `AsyncLocalStorage`. It fails **closed** — a query with no
  active tenant context throws, rather than silently running unscoped.
- **Three separate identity systems**, each with its own JWT secret, on
  purpose — a token for one must never be usable as another:
  - **School staff** (`staff` collection) — lecturers, secretariat,
    HODs, directors, and school admins. Log in by email; the school
    they belong to is resolved server-side, not chosen at login.
  - **Platform staff** (`platform_staff` collection) — the people
    running DE-SCHOOL itself (see the platform console in
    `school-frontend`), who create and manage schools.
  - **Person** (`person` collection) — a student's own, school-independent
    identity, which can be linked to one or more school-issued `Student`
    records (Stage 5 of `my-todo.md`).
- **Payments:** `utilities/stellar/` (classic Stellar payments — SEP-0007
  payment URIs, reconciliation, invoices) and `contracts/` (a real,
  deployed-to-testnet Soroban smart contract for on-chain subscription
  billing — see [`contracts/README.md`](contracts/README.md)).
- **Entitlements:** features (canteen, Stellar payments, SMS) are gated
  by a school's subscription plan (`utilities/entitlements.js`).

## Quick start

You need [Node.js 22.x](https://nodejs.org) and [MongoDB Community
Server](https://www.mongodb.com/docs/manual/administration/install-community/)
installed. Nothing else — no Docker, no real Stellar account, no real
Firebase project required to get running.

```bash
git clone https://github.com/DE-SCHOOL/school-backend.git
cd school-backend
./setup.sh
```

`setup.sh` installs dependencies, generates a `.env` with fresh random
secrets, starts a small MongoDB replica set dedicated to this project
(on its own port — it does not touch any other MongoDB instance on your
machine), generates a disposable development Firebase key so you don't
need a real Firebase project, seeds a fictional demo school with a
handful of staff and students, and starts the API on
`http://localhost:8000`. Re-run it any time — every step is safe to
repeat.

It prints two accounts at the end:

| Role | Where to use it | Email | Password |
|---|---|---|---|
| School staff (admin) | `school-frontend`'s `/auth/signin` | `admin@demo-school.cm` | `DevAdmin#2026` |
| Platform console (super-admin) | `school-frontend`'s `/platform/login` | `admin@deschool.dev` | `DevPlatform#2026` |

These are fictional seed accounts for local development only — see
[`scripts/seed-demo-data.js`](scripts/seed-demo-data.js). No real
school's data is ever part of this repository or this seed.

Now start the frontend (see
[`school-frontend`'s README](https://github.com/DE-SCHOOL/school-frontend#readme))
and sign in with either account above.

### Setting up manually, instead of `./setup.sh`

```bash
npm install
cp .env.example .env          # then fill in real values — see the comments in that file
npm run db:dev                # starts the local MongoDB replica set
npm run seed:dev-firebase-key # skip this if you have real Firebase credentials
npm run seed:demo-data
npm run start:dev
```

## Environment variables

See [`.env.example`](.env.example) for the full list with explanations.
`setup.sh` generates all of the secret values for you; nothing in that
file is safe to use as-is if you're filling it in by hand.

## Available scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Runs the API with auto-reload (nodemon). |
| `npm run lint` | ESLint — fails on real errors (undefined references, broken hook usage), not on style. |
| `npm test` | Jest unit/integration suite (no live database required). |
| `npm run verify:tenant-isolation` | Real, DB-backed proof that School A can never read/write School B's data. |
| `npm run verify:stage-4-5` | SaaS commercial layer + unified student identity, end to end. |
| `npm run verify:stage-6-8` | Stellar payments (fees, subscriptions, canteen) against Stellar **testnet**. |
| `npm run verify:soroban-backend` | The on-chain subscription-billing smart contract, through the real HTTP API. |
| `npm run verify:stage-10-canteen-concurrency` | Concurrent-load proof the canteen point-of-sale never double-spends. |
| `npm run audit:routes` | Flags any route with no authentication middleware in its handler chain. |
| `npm run db:dev` | Starts/reuses this project's own local MongoDB replica set. |
| `npm run seed:demo-data` | Seeds the fictional demo school described above. |
| `npm run seed:dev-firebase-key` | Generates a disposable local Firebase key if you don't have a real one. |
| `npm run migrate:existing-school` | Founder-only: imports a real school's production data. Not something a contributor needs or should run — see the script's own comments. |

## Testing philosophy

Beyond `npm test` (Jest, no live database), every `verify:*` script is a
real, end-to-end proof against an actual MongoDB instance — spun up
disposably for the run — driving the real Express app through
`supertest`, not a mocked one. If a `verify:*` script passes, the
behavior it names genuinely works, not just "the code that claims to
implement it exists." Several real bugs in this codebase were found
this way, not by inspection — see recent commit history for concrete
examples (a lost-update race in canteen purchases, a stale
`AsyncLocalStorage`-based module-load ordering bug, undeclared loop
variables leaking as implicit globals).

## Multi-tenancy & security

- Every tenant-owned model runs through `utilities/tenantScope.plugin.js`.
  A query with no tenant context throws — it never silently runs
  unscoped. The few legitimate exceptions (login lookups, and platform
  operations that run before any tenant exists) opt out explicitly and
  visibly with `.setOptions({ skipTenantScope: true })`.
- `scripts/audit-routes.js` parses every route file for a real
  authentication middleware in its handler chain — not a line-window
  grep, an actual balanced-paren parse — and is part of CI.
- Custodial Stellar wallet secret keys are encrypted at rest
  (`utilities/encryption.js`, AES-256-GCM) with their own dedicated key,
  separate from every JWT signing secret.

## Contributing

- All work happens on feature branches off `master`; open a pull
  request rather than pushing directly.
- CI (`.github/workflows/ci.yml`) runs on every PR: lint, the Rust
  smart-contract test suite, the full `verify:*` integration suite
  against a real disposable MongoDB, and `npm audit`. A PR with a
  failing check is not ready to merge — these gates exist to actually
  catch problems, not as a formality.
- Commit messages should explain **why**, not just restate the diff.
- `contracts/README.md` lists concrete "good first issues" for the
  Soroban smart-contract side specifically.
- See the project root's `my-todo.md` for the full build roadmap and
  which stages are done, in progress, or deliberately deferred.

## License

[MIT](LICENSE).
