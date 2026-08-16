# Multi-Tenant SaaS Subscription Platform

Octopi Digital, Jr. Full-Stack technical assessment.

Organizations register, pay through Stripe to activate, and then operate in fully
isolated spaces with their own users, subscription, and payment history. **Isolation is
enforced by the database, not by application code**: there is no `WHERE org_id = ?`
holding the tenants apart, and forgetting one cannot leak a row.

---

## Contents

- [Running it locally](#running-it-locally)
- [Test credentials](#test-credentials)
- [Architecture](#architecture)
- [Tech choices](#tech-choices)
- [Database design](#database-design)
- [Multi-tenant approach](#multi-tenant-approach)
- [Auth strategy](#auth-strategy)
- [Payment flow](#payment-flow)
- [Transactions and rollback](#transactions-and-rollback)
- [Security notes](#security-notes)
- [Tests](#tests)
- [Environment variables](#environment-variables)
- [How AI tools were used](#how-ai-tools-were-used)
- [Known limitations](#known-limitations)

---

## Running it locally

**Prerequisites:** Node 20+ (developed on 24), a PostgreSQL 14+ database, the Stripe CLI,
and a Stripe test-mode account.

There is **no root `package.json`**. `frontend/` and `backend/` are two independent
projects with two lockfiles, installed separately.

### 1. Database

Create two databases, one for the app and one for the test suite:

```bash
createdb neondb && createdb neondb_test
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env` (see [Environment variables](#environment-variables)). `ADMIN_DATABASE_URL`
must be an owner/superuser role; `DATABASE_URL` must be the non-owning `app_user`, which
the schema creates using `APP_PASSWORD`. Both databases need the schema:

```bash
npm run migrate
NODE_ENV=test npm run migrate
```

`migrate` applies `src/db/schema.sql` once and no-ops if the schema is already there.

### 3. Stripe products and test data

```bash
npm run sync:plans
npm run seed
```

`sync:plans` creates a Stripe Product and Price for each seeded plan and writes the ids
back. `seed` creates the five accounts listed below. Both are idempotent.

### 4. Webhooks

Stripe must be able to reach the local backend, and **activation only happens on a
webhook**, so this is not optional for testing payment:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` in `backend/.env`.

### 5. Run both servers

```bash
cd backend && npm run dev
```

```bash
cd frontend && npm install && cp .env.example .env && npm run dev
```

Frontend on `http://localhost:5173`, backend on `http://localhost:3000`.
Pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.

---

## Test credentials

Produced by `npm run seed`. **Password for all five accounts: `Password123!`**

| Role | Email | Organization |
|------|-------|--------------|
| Platform Admin | `platform@octopi.test` | none, by construction |
| Organization Admin | `admin@acme.test` | Acme Industries (Pro) |
| Organization Member | `member@acme.test` | Acme Industries |
| Organization Admin | `admin@globex.test` | Globex Corporation (Starter) |
| Organization Member | `member@globex.test` | Globex Corporation |

Two organizations are seeded on purpose. **Signing in as both org admins is the fastest
way to see isolation working**: each sees only its own members, subscription, and
transactions, and neither can reach the other's data by editing a URL.

Each organization is seeded with one `SUCCESS` and one `FAILED` transaction so the
transaction screens have both states to show.

---

## Architecture

### Repository shape

```
backend/     Express REST API      (independent install)
frontend/    React SPA via Vite    (independent install)
```

Two projects, two `npm install`s, no workspaces, no root package. Role and status
constants are duplicated once per side deliberately; each copy carries a comment pointing
at the other.

### Backend layout

```
src/
  app.js              middleware pipeline and route mounting
  config/env.js        validates required env vars at boot, throws if any is missing
  db/
    pool.js            appPool (RLS applies) and adminPool (RLS bypassed)
    withTenant.js      the only transaction primitive in the codebase
    schema.sql         the entire schema: tables, indexes, RLS, roles, seed
    migrate.js         applies schema.sql once
  middleware/          authenticate, authorize, requireOrgStatus, validate, rateLimit, errorHandler
  routes/              *.routes.js, one per resource: paths, middleware chain, nothing else
  modules/<feature>/   <feature>.controller.js / .service.js / .repository.js / .schema.js
  lib/                 jwt, password, tokens, cookies, errors, stripe, email, pagination
  jobs/                the daily "subscription expiring soon" reminder
```

Routes live in `src/routes/` and are separate from the modules they call, so the
**entire authorization surface of the API is readable in ten small files** without opening
a single controller. Each layer has one job:

| Layer | Responsibility | May not |
|-------|----------------|---------|
| `routes` | path, middleware chain, validation schema | contain logic |
| `controller` | unwrap `req`, call service, shape the response | contain business rules |
| `service` | business rules, orchestration, transaction boundaries | touch `req`/`res` or write SQL |
| `repository` | SQL, and only SQL | know about HTTP |

### Request pipeline

Order in `app.js` is load-bearing:

1. `helmet` → `cors({ credentials: true })` → `cookieParser`
2. **`/api/webhooks` mounts before `express.json()`** so the Stripe route receives the raw
   body bytes. Signature verification fails against a re-serialized JSON object.
3. `express.json()`
4. Resource routers, each applying `authenticate` → `requireOrgStatus` → `authorize` → `validate`
5. A catch-all 404, then `errorHandler` **last**, the only place a response body is shaped

### Four structural rules

1. **No SQL outside a repository.** Hand-written SQL is fine; scattered SQL is not.
2. **No `req` or `res` below the controller.** Services are callable from a job or a script.
3. **`withTenant()` is the only transaction primitive.** There is no second helper.
4. **`adminPool` is importable by three places only**: `modules/admin/`, `jobs/`, and
   `modules/auth/auth.repository.js`.

Rules 1 and 4 are not conventions, they are **asserted by grep tests** in
`tests/structure.test.js`. A violation fails the suite.

---

## Tech choices

| Choice | Why |
|--------|-----|
| **JavaScript (ESM), both sides** | No build step, no transpile, no source maps to debug through. The runtime guards below replace what a compiler would have caught. |
| **React SPA (Vite), TanStack Query** | The brief allows Redux Toolkit and/or TanStack Query. Every piece of state here is server state; Redux would have added a second store for nothing. |
| **Tailwind v4 + hand-written shadcn/ui primitives** | v4 needs no `tailwind.config.js` or PostCSS config, just the Vite plugin. Only the six primitives actually imported were built. |
| **Express, REST** | The brief's option. Nothing here needs GraphQL's query flexibility. |
| **PostgreSQL** | Chosen over MongoDB specifically for **Row-Level Security**, which is the isolation mechanism. Also real foreign keys, `CHECK` constraints, and partial unique indexes. |
| **Raw `pg` driver, hand-written SQL, no ORM** | RLS, `set_config`, partial unique indexes, and `count(*) OVER()` are natural in SQL and awkward-to-impossible through an ORM. SQL is confined to the repository layer. |
| **One `schema.sql` + a small runner** | The schema is final. Numbered migrations would be ceremony over one file. |
| **Stripe hosted Checkout, `subscription` mode** | No card field is ever rendered by this app, so no card data can reach the server. Also gets SCA and 3DS for free. |
| **Resend** | One API call, no SMTP configuration. |
| **Vitest + Supertest** | Vitest matches the Vite side; Supertest exercises the real Express app without binding a port. |

### No compiler, so the guards are runtime

- Every request body, query, and route param is **Zod-validated at the boundary** before a
  handler runs. Zod strips unknown keys, so a client cannot smuggle a `role` field into a handler.
- Roles, statuses, and error codes are `Object.freeze`d constants imported everywhere.
  **No bare string literals in comparisons**, so a typo throws instead of quietly evaluating false.
- `config/env.js` throws at boot if any required variable is missing, rather than failing
  on the first request that needed it.

---

## Database design

Nine tables.

| Table | Purpose | RLS |
|-------|---------|-----|
| `organizations` | The tenant. Name, billing email, status, Stripe customer id | **on** |
| `users` | One row per person. `org_id` is `NULL` only for a Platform Admin | **on** |
| `plans` | Platform-owned reference data, with Stripe product/price ids | off |
| `subscriptions` | One live subscription per org, with period window and Stripe id | **on** |
| `transactions` | Every payment attempt, in all five brief statuses | **on** |
| `notifications_log` | One row per email sent, with a unique dedup key | **on** |
| `stripe_events` | Processed webhook event ids. The replay guard | off |
| `refresh_tokens` | Hashed rotating refresh tokens, grouped into families | off |
| `one_time_tokens` | Hashed single-use invite and password-reset tokens | off |

The four RLS-off tables are off for a stated reason: `plans` is read by unauthenticated
visitors on the landing page; `stripe_events` has no tenant column; the two token tables
are keyed by user and reachable only by presenting the token itself.

### Conventions, and why

| Convention | Reason |
|------------|--------|
| `uuid` primary keys | Sequential integers let one tenant enumerate another's ids. |
| `timestamptz` everywhere | A billing period that shifts with the server's time zone is a billing bug. |
| Integer **cents**, never float | `19.99` is not representable in binary floating point. |
| `text` + `CHECK` instead of native enums | A PostgreSQL enum cannot have a value removed and needs a migration to extend. A `CHECK` is editable and readable in plain SQL. |
| `jsonb` for `plans.features` | A genuinely variable-length list with no query requirement against its elements. |

### Invariants the database enforces, not the service

These are the ones worth pointing at, because each replaces a race condition that
application code cannot close:

| Constraint | What it prevents |
|------------|------------------|
| `stripe_events` PRIMARY KEY on the event id | Duplicate webhook processing. Inserted **first**, inside the same transaction as its effects. |
| `one_live_subscription_per_org`, a partial unique index on `(org_id) WHERE status IN ('PENDING','ACTIVE')` | Two live subscriptions for one organization, including under concurrent requests. Historical rows are unaffected. |
| `platform_admin_has_no_org`: `CHECK ((role = 'PLATFORM_ADMIN') = (org_id IS NULL))` | A Platform Admin inside a tenant, or an org user without one. Both directions, one constraint. |
| `active_user_has_password`: `CHECK (status <> 'ACTIVE' OR password_hash IS NOT NULL)` | An `ACTIVE` user with no password, which is an unauthenticatable account. |
| `notifications_log.dedup_key UNIQUE` | Double-sending an email. The key is claimed before the send, so the claim is what dedupes. |
| `plans … ON DELETE RESTRICT` | Deleting a plan that subscriptions still reference. Disabling via `is_active` is the supported path. |
| `ON DELETE CASCADE` from `organizations` | Orphaned tenant rows if an organization is ever deleted. |

### Indexes

Each one serves a query that actually exists:

| Index | Query it serves |
|-------|-----------------|
| `idx_orgs_status`, `idx_orgs_created_at` | Platform admin org list, filtered by status, sorted newest first |
| `idx_users_org_id`, `idx_users_org_status` | Member list, and the active-seat count behind the seat limit |
| `idx_subs_org_status` | Finding an organization's live subscription |
| `idx_subs_period_end WHERE status = 'ACTIVE'` | The daily expiring-soon job, which only ever looks at active rows |
| `idx_txn_org_created` | Transaction history, newest first, the most-hit tenant query |
| `idx_txn_status`, `idx_txn_checkout_session` | Platform transaction filter; webhook lookup by session |
| `idx_refresh_user WHERE revoked_at IS NULL` | Revoking a user's live sessions without scanning dead ones |
| `idx_ott_user_purpose WHERE used_at IS NULL` | Unused invite / reset token lookup |

---

## Multi-tenant approach

The brief asks for this to be documented **and justified**, so it gets the most space.

### The decision: RLS, not a `WHERE` clause

The usual approach is a shared schema with `WHERE org_id = ?` on every query. It works
until someone forgets it once, and that single omission is a cross-tenant data leak that
no type system and no code review reliably catches.

This project instead uses **PostgreSQL Row-Level Security**. The tenant predicate lives in
the database, applies to `SELECT`, `INSERT`, `UPDATE`, and `DELETE`, and cannot be
forgotten by a developer writing a new query.

| Option | Trade-off |
|--------|-----------|
| `WHERE org_id = ?` in every query | Zero infrastructure. One forgotten clause is a breach. Rejected. |
| Schema-per-tenant | Hard isolation, but N-schema migrations and connection-pool pressure. Overkill at this scale. |
| Database-per-tenant | Hardest isolation, worst operational cost. Wildly disproportionate. |
| **Shared schema + RLS (chosen)** | The predicate is declarative, central, and enforced below the application. |

### The policy

```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON transactions
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
```

Identical on `users`, `subscriptions`, and `notifications_log`. On `organizations` the
predicate compares `id` rather than `org_id`.

No `FOR` clause means `FOR ALL`, and with `WITH CHECK` omitted the `USING` expression
governs writes too. That is deliberate: **it is what stops a tenant writing into another
tenant**, not just reading from one.

### The helper

```js
export async function withTenant(orgId, fn) {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    // SET LOCAL does not accept bind parameters; set_config does.
    // The third argument true makes the setting transaction-local, so it
    // cannot leak to whichever request borrows this pooled connection next.
    await client.query('SELECT set_config($1, $2, true)', ['app.current_org_id', orgId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

Two details here are easy to get wrong and both matter:

1. **`SET LOCAL` takes no bind parameters.** Interpolating the org id into a `SET LOCAL`
   string would be string-building a SQL statement out of a request-derived value.
   `set_config($1, $2, true)` is parameterised.
2. **The third argument makes the setting transaction-local.** Without it, the value
   survives `COMMIT` and stays on the pooled connection, so the *next* request to borrow
   that connection would run as the previous tenant. This is the single worst bug this
   design can have, and one boolean prevents it.

### RLS is bypassed by the table owner

This is the part that is most often missed and would have made every isolation test pass
for the wrong reason.

**RLS does not apply to superusers, and it does not apply to the role that owns the
table.** A managed Postgres provisions an owner role that owns everything. Connecting the
application as that role means the policies are silently inert while looking perfectly
configured.

So `schema.sql` creates a **second, non-owning role, `app_user`**, grants it DML only, and
`DATABASE_URL` connects as that role. The privileged `ADMIN_DATABASE_URL` is a separate
pool used only where crossing tenants is the actual intent.

The very first test in `tests/isolation.test.js` asserts this before any isolation
assertion runs:

```js
expect(rows[0].role).toBe('app_user');
expect(rows[0].is_super).toBe(false);
expect(rows[0].owner).not.toBe(rows[0].role);
```

Without that check, the whole isolation suite is decorative.

### One subtlety that took a real bug to find

`current_setting('app.current_org_id', true)` with `missing_ok = true` is documented to
return `NULL` when the setting was never set. That is only true for a GUC that has never
been referenced in the backend session.

PostgreSQL creates a *placeholder* for a custom dotted GUC the first time it is
`set_config`'d in a backend, and **that placeholder's reset value is `''`, not unset**.
Because pooled connections reuse long-lived backends, the first `withTenant()` call on a
given backend permanently flips the reset value from "unset" to empty string. Every later
query outside `withTenant` on that same backend then evaluates `''::uuid` and raises
`22P02 invalid input syntax for type uuid`, instead of safely returning zero rows.

`NULLIF(current_setting(...), '')` collapses both "never set" and "set then reverted" to
`NULL`, which is what `missing_ok` was intended to give. This was found by a failing test,
not by reading the docs.

### The two deliberate exceptions

Both are narrow, both are on an allowlist enforced by a grep test:

1. **`modules/admin/`**: cross-organization access is this module's entire purpose. It is
   a separate route prefix (`/api/admin`), on a separate pool, behind
   `authorize(ROLES.PLATFORM_ADMIN)`. Its repository selects explicit column lists, never
   `SELECT *`, so a password hash cannot escape.
2. **`modules/auth/auth.repository.js`**: authentication is keyed by **email or token
   hash, never by tenant**. Under the `users` policy a login lookup returns zero rows, so
   login, refresh, password reset, and invite acceptance would all be impossible. It
   exposes five single-identity functions, four lookups and one password write;
   **none accepts an `org_id` and none returns a list**. A Platform Admin has `org_id IS NULL` and is unreachable under any value of the
   setting, which is a second reason this exception must exist.

The alternative, relaxing the `users` policy, was rejected outright: it is the isolation
guarantee.

### The consequence that shapes the API

A wrong-tenant read returns **zero rows**, not an error. The service cannot distinguish
"belongs to another organization" from "never existed", so it raises the same not-found
error for both and the API answers **`404`, not `403`**.

That is non-disclosure by construction rather than by discipline: the API physically
cannot confirm that another tenant's resource exists, because the code path that would
have to know never sees the row.

---

## Auth strategy

### Tokens

| Token | Lifetime | Stored where | Stored how |
|-------|----------|--------------|------------|
| Access (JWT) | 15 minutes | Frontend **memory only** | Not persisted |
| Refresh | 30 days | `httpOnly` cookie, `path=/api/auth` | **SHA-256 hash only** in `refresh_tokens` |

The access token carries `userId`, `orgId`, and `role`, so `withTenant` gets its tenant
from the verified token with **no extra database lookup per request**.

The access token is deliberately **not** in `localStorage`; anything there is readable by
any injected script. It lives in a module variable and is rebuilt from the refresh cookie
on reload. The refresh cookie is `httpOnly`, so JavaScript cannot read it at all.

Refresh tokens are stored **only as hashes**. A database disclosure yields no usable
session.

### Rotation and reuse detection

Every refresh rotates: the presented token is revoked and a new one issued in the same
`family_id`. If an **already-revoked** token is presented, that means it was either
rotated already or stolen, so **the entire family is revoked** and the user must sign in
again.

The frontend keeps a **single in-flight refresh** shared by all callers. Without it, five
parallel queries hitting a 401 at once would rotate five times and four would trip the
reuse detector, logging the user out for no reason. Only `TOKEN_EXPIRED` triggers a
retry; a 403, or a 401 from bad credentials, must never spend a refresh token.

### Passwords and one-time tokens

bcrypt at **12 rounds**. Invite and password-reset tokens are random, **single-use**
(`used_at` is claimed atomically), expiring (7 days for invites, 1 hour for resets), and
stored as hashes. A completed password reset **revokes every refresh family** for that
user, because a reset is also the remedy for a compromised session.

### Rate limits

| Endpoints | Limit |
|-----------|-------|
| `login`, `register` | 10 per 15 minutes |
| `forgot-password`, `reset-password`, `invite/:token`, `accept-invite` | 5 per hour |

Disabled under `NODE_ENV=test` so the suite is not throttled by its own fixtures.

### Authorization: three independent gates

Every protected route composes up to three middlewares, and each answers a different
question:

1. `authenticate`: is this a valid, unexpired token? (`401`)
2. `requireOrgStatus(...tier)`: is the organization in a state that permits this? (`403`)
3. `authorize(...roles)`: does this role have this capability? (`403`)

The organization status gate has **three tiers**, so a suspended or cancelled org loses
the right things and keeps the rest:

| Tier | Admits | Used by |
|------|--------|---------|
| `ANY` | `PENDING`, `TRIAL`, `ACTIVE`, `CANCELLED`, `SUSPENDED` | Reading the org, reading transactions, polling the subscription after checkout |
| `BILLABLE` | `PENDING`, `TRIAL`, `ACTIVE`, `CANCELLED` | Starting checkout, the billing portal. A suspended org cannot pay its way back in. |
| `OPERATING` | `TRIAL`, `ACTIVE`, `CANCELLED` | Member management, plan changes, editing the org. A `PENDING` org cannot invite anyone before it has paid. |

A **`PLATFORM_ADMIN` is refused every org-scoped route explicitly**, not by omission:
`requireOrgStatus` checks for a null `orgId` first and returns a clean `403`. Without that,
a platform admin hitting `/api/transactions` would reach `withTenant(null, …)` and crash
on a null uuid. Verified live: it answers `403 FORBIDDEN_ROLE`.

Frontend route guards exist and redirect by role, but they are **cosmetic**. Every check
above runs server-side regardless of what the SPA renders.

---

## Payment flow

**The rule everything else follows from: activation happens only on a
signature-verified Stripe webhook. The browser's return from Stripe carries no
authority whatsoever.** The success page is a polling screen, not a state change.

### Registration to activation

1. `POST /api/auth/register` validates input and checks email availability, so the ordinary
   duplicate never reaches Stripe. The `UNIQUE` constraint remains the real guard.
2. The application **generates all four ids itself** (`orgId`, `userId`, `subscriptionId`,
   `transactionId`) with `randomUUID()`. It has to: the `organizations` insert is checked
   against `id = current_setting('app.current_org_id')` under RLS, so the id must exist
   *before* the transaction opens.
3. A Stripe **Customer** is created.
4. A Stripe **Checkout Session** is created in `subscription` mode, carrying
   `metadata: { orgId, subscriptionId, transactionId }`. **The webhook arrives with no
   session and no JWT, so the tenant has to travel with the event.**
5. **One transaction** writes four rows: `organizations` (`PENDING`), `users` (`ORG_ADMIN`,
   `ACTIVE`), `subscriptions` (`PENDING`), `transactions` (`PENDING`).
6. Tokens are issued and the `checkoutUrl` is returned. The browser goes to Stripe.

**Every Stripe call happens before the transaction opens.** A network call inside a
database transaction holds a connection and a row lock for the duration of an unbounded
third-party round trip. The accepted cost is explicit: if the insert then fails, an orphan
Stripe Customer is left behind. That is harmless, and cheaper than the alternative.

On a failed or abandoned payment nothing is activated: the organization stays `PENDING`
and the user can retry checkout from the dashboard, which reuses the existing pending
transaction row rather than accumulating new ones.

### Webhook events handled

| Event | Effect |
|-------|--------|
| `checkout.session.completed` | Transaction → `SUCCESS`, subscription → `ACTIVE` with its period window, organization → `ACTIVE` |
| `invoice.paid` | Renewal. New `SUCCESS` transaction, subscription period advanced |
| `invoice.payment_failed` | New `FAILED` transaction. **Subscription untouched**, because Stripe is still retrying on its own schedule |
| `customer.subscription.updated` | Period window and `cancel_at_period_end` synced; `unpaid` maps to `FAILED` |
| `customer.subscription.deleted` | Subscription → `EXPIRED` |
| `charge.refunded` | Transaction → `REFUNDED` |

Two decisions inside that table are worth calling out:

- **`invoice.paid` is skipped when `billing_reason === 'subscription_create'`.** The first
  invoice fires alongside `checkout.session.completed`; handling both would write **two
  `SUCCESS` transactions for one charge**.
- **An unhandled event type is answered `200` but never recorded.** `stripe_events` means
  *processed*, not *seen*. Recording an event the app ignored would suppress it if it later
  became handled.

Renewal events carry no `orgId` in their own metadata, so the tenant is recovered from the
Stripe subscription's metadata, which was set at creation.

A subscription's period dates are read from **the subscription item**, falling back to the
top-level field. Recent Stripe API versions moved `current_period_start`/`end` onto items;
reading only the top level silently produced a `null` renewal date on every activated
subscription. This was found by running a real paid signup against Stripe test mode, not
by the test suite, whose local fixtures still used the older shape.

### Subscription state machine

| From | To | Trigger |
|------|----|---------|
| (none) | `PENDING` | Registration, or a new checkout |
| `PENDING` | `ACTIVE` | `checkout.session.completed` |
| `ACTIVE` | `ACTIVE` | `invoice.paid` (renewal, period advances) |
| `ACTIVE` | `FAILED` | `customer.subscription.updated` with Stripe status `unpaid` |
| `ACTIVE` | `CANCELLED` | Org admin cancels. Stripe gets `cancel_at_period_end` |
| `ACTIVE` / `CANCELLED` | `EXPIRED` | `customer.subscription.deleted` |

### Email notifications

All seven triggers the brief names, via Resend: member invited, payment succeeded, payment
failed, subscription upgraded, downgraded, cancelled, and expiring soon (a daily `node-cron`
job over subscriptions ending within 3 days).

Every send is **logged before it is sent**, claiming a `UNIQUE dedup_key`. The claim is
what dedupes, so a repeat is a no-op rather than a second email. `notify()` **never
throws**: an unsent email must not undo a committed payment.

---

## Transactions and rollback

### The boundary

Webhook processing is one `withTenant` transaction containing exactly four statements:

```
BEGIN
  set_config('app.current_org_id', orgId, true)
  INSERT INTO stripe_events (id, type)     <- FIRST. The replay guard.
  UPDATE transactions   SET status = 'SUCCESS' …
  UPDATE subscriptions  SET status = 'ACTIVE'  …
  UPDATE organizations  SET status = 'ACTIVE'  …
COMMIT
```

The `stripe_events` insert is **first on purpose**. It is a plain primary-key insert, so a
replay collides immediately and rolls back before touching anything else. Idempotency is a
database constraint, not a check-then-act, so it holds even if two deliveries of the same
event arrive concurrently.

**Deliberately outside the transaction:** signature verification, every Stripe API read,
and every email. The Stripe reads are out because a third-party round trip must not hold a
lock. Emails are out because **an email cannot be rolled back**, so they are sent strictly
after commit.

### The three outcomes

| Outcome | What happens | Response |
|---------|--------------|----------|
| **Success** | All four statements commit together, then the email is dispatched | `200` |
| **Replay** | The `stripe_events` insert hits the primary key, the whole transaction rolls back, **nothing changes**. The row already reads `SUCCESS` from the first delivery | `200` |
| **Genuine failure** | Everything rolls back, **including the `stripe_events` row**, which leaves the event id free for the retry. A **second** transaction then writes `ROLLED_BACK` to the transaction row | `500`, so Stripe retries |

### Two subtleties

**Why `ROLLED_BACK` needs a second transaction.** The status describes a transaction that
was rolled back. Writing it inside that same transaction would roll the write back too.
It is therefore written from a fresh `withTenant` call after the first has aborted.
`markRolledBack` is guarded on `status = 'PENDING'` so a later retry that already settled
is never overwritten.

**Why `markSuccess` admits `ROLLED_BACK` as well as `PENDING`:**

```sql
WHERE id = $1 AND status IN ('PENDING','ROLLED_BACK')
```

Stripe retries a `500`. If the first delivery failed and wrote `ROLLED_BACK`, a
`PENDING`-only guard would mean the retry silently matches zero rows and **a payment that
failed once could never settle**. The organization would be charged and never activated.

`tests/rollback.test.js` covers this: a forced mid-transaction failure leaves the
organization `PENDING`, the subscription `PENDING`, and the transaction `ROLLED_BACK`, with
no partial write anywhere.

---

## Security notes

### Payment

- **No card number, CVV, or payment credential is stored, and none reaches the server.**
  Hosted Checkout and the Stripe Customer Portal mean this application never renders a
  card field at all. The strongest version of "don't store card data" is "never receive it".
- **Webhook authenticity** is verified with `stripe.webhooks.constructEvent` against the
  raw request body. This is exactly why the webhook route mounts before `express.json()`:
  a re-serialized object does not match the signature Stripe computed.
- **Every payment is verified server-side.** No client call can move an organization to
  `ACTIVE`.
- **Secrets live in `.env` only**, validated at boot, never in code, never committed.
  `.env.example` carries placeholders and stays current.

### Information disclosure

The smaller decisions, which are where tenancy bugs usually hide:

- **Login answers identically** for a wrong password, an unknown address, a non-`ACTIVE`
  user, and a user with no password. One `fail()` closure builds all four, so the response
  cannot be used to enumerate accounts.
- **Forgot-password answers the same** whether or not the address exists.
- **Inviting an address that belongs to another tenant** answers `EMAIL_IN_USE`, not
  `ALREADY_A_MEMBER`. The latter would confirm that a specific person belongs to some
  other organization on the platform.
- **Wrong-tenant access answers `404`, not `403`**, for the structural reason described
  above.
- **`errorHandler` is the only place a response body is shaped.** Anything that is not an
  `AppError` is logged in full server-side and returned as
  `{ code: 'INTERNAL', message: 'Something went wrong.' }`. No stack trace, no driver
  message, no constraint name escapes.
- **Sort order is fixed per endpoint and never client-supplied**, keeping user input out of
  `ORDER BY`, where it cannot be parameterised.
- **The admin repository selects explicit column lists.** A `SELECT *` on `users` there
  would ship `password_hash` across a tenant boundary.
- **`helmet`** for response headers, **CORS locked to a configured origin** with
  `credentials: true`.

---

## Tests

```bash
cd backend && npm test
```

**253 tests across 35 files, all passing.**

> **Caveat, stated up front:** this suite was AI-written and served as the agent's own
> verification loop between tasks. It was **not line-by-line reviewed by hand**. I stand
> behind what it covers, listed below, but treat the individual assertions as
> machine-checked rather than human-audited. See
> [How AI tools were used](#how-ai-tools-were-used).

### Coverage of the six areas the brief names

| Area | Suite |
|------|-------|
| Authentication | `auth.test.js`, `refresh.test.js`, `password-reset.test.js`, `accept-invite.test.js`, `authenticate.test.js` |
| Role authorization | `authorization.test.js`, `guards.test.js`, `admin-*.test.js` |
| Tenant isolation | `isolation.test.js` |
| Payment flow | `registration.test.js`, `webhook-activation.test.js`, `webhook-lifecycle.test.js`, `subscription-actions.test.js` |
| Duplicate webhook | `webhook-activation.test.js` |
| Transaction rollback | `rollback.test.js` |
| Structural rules | `structure.test.js` |

The seventh is not in the brief. Two of this project's guarantees are architectural rather
than behavioural (no SQL outside a repository, `adminPool` confined to three paths), and a
grep is the only thing that can assert them.

### A real database, never a mock

Every test runs against a real PostgreSQL. **The data layer is never mocked.** This is not
a preference: RLS policies, `CHECK` constraints, and partial unique indexes *are* the
correctness mechanism here. A mock would assert that the code called a function; what
needs asserting is that **the database refused the write**. The refusal is the feature.

Tests truncate between cases rather than wrapping each in a rolled-back transaction,
because `withTenant` *is* the transaction primitive and the code under test opens and
commits its own. An outer transaction would turn every commit into a savepoint release and
quietly change the behaviour being tested, especially in the rollback suite.

Stripe is stubbed for outbound calls; inbound webhooks are **signed locally with the real
signing algorithm**, so signature verification is genuinely exercised. Resend is stubbed
globally, so no suite makes a network call by triggering `notify()`.

### No frontend tests

Stated plainly because it is a deliberate choice, not an oversight: all six areas the brief
names are backend concerns, and the brief's closing rule is to build exactly what is
described and nothing more. Frontend verification was manual, plus a full live run against
Stripe test mode with `stripe listen` forwarding webhooks: two organizations registered,
paid, and activated end to end on two different plans, with isolation confirmed at both the
UI and the raw API response level.

---

## Environment variables

### `backend/.env`

| Name | Required | Purpose |
|------|----------|---------|
| `DATABASE_URL` | yes | Connects as **`app_user`**, the non-owning role. RLS applies. |
| `ADMIN_DATABASE_URL` | yes | Owner/superuser. Runs the schema, and backs `adminPool`. RLS bypassed. |
| `TEST_DATABASE_URL` | for tests | As above, against the test database. Substituted when `NODE_ENV=test`. |
| `TEST_ADMIN_DATABASE_URL` | for tests | As above. |
| `APP_PASSWORD` | yes | Password `schema.sql` gives `app_user` at creation. Must match `DATABASE_URL`. |
| `JWT_SECRET` | yes | Access token signing key. |
| `ACCESS_TOKEN_TTL` | no (`15m`) | Access token lifetime. |
| `REFRESH_TOKEN_TTL_DAYS` | no (`30`) | Refresh token lifetime, also the cookie `maxAge`. |
| `STRIPE_SECRET_KEY` | yes | `sk_test_…`. |
| `STRIPE_WEBHOOK_SECRET` | yes | `whsec_…` from `stripe listen`. |
| `RESEND_API_KEY` | yes | Email delivery. |
| `EMAIL_FROM` | yes | Sender address on notifications. |
| `APP_URL` | yes | Frontend origin. Builds Checkout success/cancel and email links. |
| `CORS_ORIGIN` | yes | Allowed browser origin. |
| `PORT` | no (`3000`) | API port. |
| `NODE_ENV` | no (`development`) | `test` swaps in the test database and disables rate limits. |
| `COOKIE_SECURE` | no (`false`) | `true` in production: sets `Secure` and `SameSite=None`. |

Boot fails immediately if any required variable is missing.

### `frontend/.env`

| Name | Required | Purpose |
|------|----------|---------|
| `VITE_API_URL` | yes | API base, e.g. `http://localhost:3000/api`. |

---

## How AI tools were used

The brief asks directly, so this is specific rather than diplomatic.

**AI was used heavily, and the whole project was built agentically.** It was not prompted
ad hoc. The work ran through a "superpowers" workflow, which is a discipline for agentic
development rather than a library:

| Stage | What it produces | Rule |
|-------|------------------|------|
| **Brainstorm** | Requirements interrogated before anything is designed | No code until the intent is settled |
| **Spec** | Design documents with single ownership per topic, so nothing is restated and nothing can drift out of agreement with itself | One topic, one file |
| **Decision record** | Every non-obvious choice with its alternatives and rationale | Settled decisions are not re-litigated |
| **Plan** | A task-by-task checklist with explicit exit criteria | Progress state lives in the checklist, not in memory |
| **Execute** | One fresh agent per task, starting from the plan | Tick the box only after that task's tests pass |

### Model split, and human review

**Everything up to and including planning used a stronger model. Implementation used a
weaker, cheaper one.** That split is the whole point of writing the spec and plan first: the
expensive reasoning goes into deciding *what* to build and *why*, and once the decisions are
written down, turning a well-specified task into code is a much smaller problem. A weaker
model executing a precise plan outperforms a stronger model improvising.

**I reviewed between tasks, not after.** Each task landed as its own commit, and I read the
diff, the decisions it implied, and its tests before the next task started. Where I
disagreed, the decision record was amended and the reasoning recorded, rather than the code
being quietly patched. Two phases were run in a single pass at my explicit direction to save
time, and those are noted as exceptions in the decision record.

**One honest caveat about the tests.** The test suite was written by AI and was **not
line-by-line reviewed by me**. It exists as the agent's own verification loop: a check that
each task did what the plan said before the next one began. I have read what it *covers* and
I stand behind the six areas it targets, but treat the assertions themselves as
machine-checked rather than human-audited. The behaviour I personally verified is the live
run described under [Tests](#tests): real Stripe test mode, real webhooks, two organizations
paid and activated end to end.

### Where the value actually was

- **Design review found real problems before any code existed.** A structured review round
  against the first schema draft raised **eleven concerns, of which nine were valid**. The
  most important: under the `users` RLS policy, **login is impossible**, because
  authentication is keyed by email and a login lookup returns zero rows before a tenant is
  known. That is a design-breaking flaw, and it surfaced from a document review rather than
  from a debugging session at 2am. The fix became the narrow privileged auth repository
  described above, chosen over three alternatives that were written down and rejected in
  the decision record.

- **Two dormant bugs were found by running the thing for real, not by AI.** The webhook
  handler read `current_period_start`/`end` off the top-level Stripe Subscription object;
  recent API versions moved them onto the subscription item, so every activated
  subscription silently had a `null` renewal date. The test suite passed throughout,
  because its locally-signed fixtures still used the older field shape. Only a real paid
  signup against Stripe test mode exposed it. Separately, the frontend auth provider
  cleared the whole query cache on a failed session restore, wiping already-loaded public
  queries on first page load.

- **Suggestions were rejected where they were wrong.** Relaxing the `users` RLS policy to
  make login work was rejected outright: it is the isolation guarantee, and the cheap fix
  would have removed the thing being demonstrated. `SECURITY DEFINER` functions were
  considered for the same problem and rejected for putting application logic into database
  objects.

- **Every non-obvious decision is written down** with its alternatives and its rationale,
  in a decision record that is kept out of the repository. Where a comment in the code says
  "this order is load-bearing" or "this is deliberate", it is pointing at one of those
  entries.

The honest summary: AI made it possible to build this much in two days, and its biggest
contribution was **structured design review before implementation**, not code generation.
That is also why the model split works. Once the hard thinking is written down as a spec, a
decision record, and a task list, execution is the cheap part.

It did not catch the two bugs that mattered most; running the real system against real
Stripe did. And the test suite, which is the one artifact I did not review closely, is
exactly where I would look first if something here turned out to be wrong. Every line of
the application code is code I can explain and modify.

---

## Known limitations

Honest, specific, and each with what comes next.

| Limitation | What I would do next |
|------------|---------------------|
| **`TRIAL` exists in the org status enum but no flow produces it.** The brief's admin filter lists it, so it is in the enum and in the gate tiers, but nothing sets it. | Either add a trial signup path, or drop the value. Leaving a reachable-looking state unreachable is a wart. |
| **Revenue is grouped by currency, never summed across currencies.** `transactions.currency` is per row, so a single headline figure would be arithmetic on incompatible units. | A rates table plus a chosen reporting currency, with the rate stamped per transaction. |
| **Plan downgrades take effect immediately, with proration.** | A `pending_plan_id` column and a second seat check at the period boundary, so a downgrade applies at renewal instead. |
| **Refunds are reflected from Stripe but cannot be issued from the app.** `charge.refunded` sets `REFUNDED`; there is no refund button. | An admin refund action calling the Stripe refund API, behind a confirmation. |
| **One user belongs to exactly one organization.** `users.org_id` is a single column, and the JWT carries one `orgId`. | A real `memberships` table and an org-switcher, plus a migration. It was a deliberate simplification for login and JWT simplicity. |
| **The test suite was not human-reviewed line by line.** It was AI-written as the agent's verification loop between tasks. What it covers is deliberate; the individual assertions are machine-checked. | Read the suite properly, and add a mutation-testing pass, which is the real check on whether assertions bite. |
| **No frontend tests**, for the scope reason given above. | Component tests for the guard and form logic, and a Playwright pass over signup → checkout → activation. |
| **No CI pipeline.** The optional CI/CD bonus was not claimed. | A GitHub Actions workflow running both projects' lint, the backend suite against a service-container Postgres, and the frontend build. |
| **PDF invoices and per-organization SMTP were skipped.** Both are optional bonuses. Invoices link to Stripe's hosted invoice URL instead. | Puppeteer for the PDF; encrypted-at-rest credentials for per-org SMTP. |
| **The expiring-soon job runs in-process** via `node-cron`. Two API instances would send two reminders were it not for the dedup key. | A real scheduler, or an advisory lock around the run. |
| **Seeded demo transactions are written directly**, not through Stripe, so their ids are synthetic. | Nothing, this is a seed script for graders, and real payments go through the real path. |

---

Built for the Octopi Digital Jr. Full-Stack assessment.
