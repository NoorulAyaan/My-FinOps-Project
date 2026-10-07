# CloudPulse Backend

Auth API for [CloudPulse FinOps](../frontend), the React frontend in the sibling `frontend/`
directory. This slice covers **sign up, email verification, sign in and cloud-account storage** —
there is no billing or resource data yet.

Express 4 + node-postgres + JWT + bcrypt. ESM, matching the frontend's `"type": "module"`.

---

## Setup

Requires Node 20+ and a running Postgres. The local one used during development:

```bash
docker run -d --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=finops_dev_pw \
  -e POSTGRES_DB=finops \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql \
  postgres:16
```

> On `postgres:18` and newer, mount the volume at `/var/lib/postgresql`, **not**
> `/var/lib/postgresql/data`. The 18 image moved `PGDATA` to
> `/var/lib/postgresql/18/docker` and refuses to start if it finds what looks like
> a pre-18 cluster at the old path.

Then:

```bash
npm install
cp .env.example .env      # then edit DATABASE_URL and the two secrets
npm run migrate
npm run dev
```

The API listens on <http://localhost:4000>.

### Generating secrets

`.env` is gitignored. The two JWT secrets must be different and long enough:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
```

`src/config.js` refuses to boot on a placeholder, on a secret shorter than 16
characters (32 in production), or if both secrets are equal.

### Avatars

Uploaded avatars are written to `UPLOAD_DIR/avatars` (default `./uploads/avatars`,
overridable with `UPLOAD_DIR`) and served back from `/uploads/avatars`. Nothing else in
the API reads that directory, and files are named by the server rather than by the
uploader.

`backend/uploads/` is gitignored. On a deploy, that path needs a persistent volume —
otherwise every avatar disappears when the container is replaced. If you would rather
not manage a volume, that directory is the only thing to swap for object storage.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start with hot reload (`node --watch`) |
| `npm start` | Start normally |
| `npm run migrate` | Apply pending `db/*.sql`, tracked in `schema_migrations` |
| `npm run mail:test` | Check the SMTP settings; add an address to also send a test mail |
| `npm test` | Run the suite against the test databases |

`npm test` needs two throwaway databases (they are truncated per run, never touched):

```bash
docker exec postgres psql -U postgres -c "CREATE DATABASE finops_test;"
docker exec postgres psql -U postgres -c "CREATE DATABASE finops_test_cloud;"
```

---

## Endpoints

Bodies and responses are JSON. Auth lives under `/api/auth`, cloud accounts under
`/api/cloud-accounts`.

### `POST /api/auth/signup`

```json
{ "name": "Devin Patel", "email": "devin@acme.corp", "password": "correct-horse-9", "confirm": "correct-horse-9" }
```

`201` on success, `409` if the email is taken, `422` on validation failure.

Returns the user with `emailVerified: false` and **no session** — verification comes
first:

```json
{
  "user": { "id": "1", "name": "Devin Patel", "email": "devin@acme.corp", "emailVerified": false, "createdAt": "..." },
  "emailSent": false,
  "devCode": "417305",
  "verificationExpiresAt": "..."
}
```

`devCode` only appears when `SMTP_HOST` is unset (console transport). With SMTP
configured, the code is emailed and never returned in the response.

### `POST /api/auth/verify-email`

```json
{ "userId": "1", "code": "417305" }
```

`200` with the usual session body and the user now `emailVerified: true`. `400` if the
code is wrong or expired, `429` once the attempt cap (5) is reached.

### `POST /api/auth/resend-verification`

```json
{ "email": "devin@acme.corp" }
```

Always `200` with the same message, whether or not the address is registered or already
verified. Includes `devCode` in console mode only. See
[Email verification behaviour](#email-verification-behaviour).

### `POST /api/auth/signin`

```json
{ "email": "devin@acme.corp", "password": "correct-horse-9", "remember": true }
```

`remember` drives the refresh token lifetime only — 30 days when `true`, 1 day when
omitted. The access token is 15 minutes either way.

`200` on success, `401` if the credentials do not match, `403 email_not_verified` if the
address has not been verified, `422` on validation failure.

### `POST /api/auth/forgot-password`

```json
{ "email": "devin@acme.corp" }
```

Always `200` with the same message, whether or not the address is registered. Includes
`devCode` in console mode only. See [Email verification behaviour](#email-verification-behaviour)
— the non-enumeration reasoning applies here identically.

Issuing a new code consumes any previous one, so only the newest email works.

### `POST /api/auth/reset-password`

```json
{ "email": "devin@acme.corp", "code": "123456", "password": "new-pass-9", "confirm": "new-pass-9" }
```

Takes the **email**, not a user id: the forgot-password response must stay identical for
registered and unknown addresses, so it cannot hand back an id that would reveal which
accounts exist. The code is the only secret.

`200` on success. The new password is hashed, the code is consumed, and **every refresh
token for the user is revoked** — so any session an attacker was holding stops working.

`400` if the code is wrong, expired, spent, or belongs to a different address, or if the
address is not registered (deliberately identical to the other cases). `429` once the
attempt cap (5) is reached. `422` on validation failure.

### `POST /api/auth/refresh`

```json
{ "refreshToken": "..." }
```

Returns a fresh access/refresh pair and revokes the presented token. `401` if the
token is unknown, already used, revoked or expired.

### `POST /api/auth/logout`

```json
{ "refreshToken": "..." }
```

Always `204`, with or without a token.

### `GET /api/auth/me`

Requires `Authorization: Bearer <accessToken>`. Returns the current user.

### `PATCH /api/auth/me`

```json
{ "name": "Devin Patel", "timezone": "Europe/London" }
```

Updates the profile. Both fields are optional, but at least one must be present; an
explicitly empty `name` is a `422` rather than a silent no-op. `timezone` accepts IANA
names only (`Area/City`, optionally with a third segment) and can be set to `null`.
`timezone` is not used for anything yet. `422` returns a `details` object keyed by
field.

Returns the updated user. The email address is not changeable here.

### `POST /api/auth/me/avatar`

`multipart/form-data` with one `avatar` part. Accepts PNG, JPEG, WebP and GIF, verified
by magic bytes rather than the declared content type, up to `AVATAR_MAX_BYTES` (2 MB).

The file is stored under `UPLOAD_DIR/avatars` with a generated name, so an uploaded
filename is never used as a path. Returns the updated user. The previous file is only
unlinked after the database row points at the new one, so a database failure cannot
leave the account without an avatar.

### `DELETE /api/auth/me/avatar`

Removes the avatar file and clears `avatar_path`. `204`. Safe to call when there is no
avatar.

### `POST /api/auth/change-password`

```json
{ "currentPassword": "...", "newPassword": "..." }
```

Requires the current password, so a stolen session cannot lock the owner out. On
success the password is re-hashed and **every other session is revoked**; the session
that made the request stays valid. `401` if the current password is wrong, `422` on a
new password that fails validation.

Note this is *not* the same as the reset flow: it never emails anything and never
leaves an existing session usable on another device.

### Account sessions

All require `Authorization: Bearer <accessToken>` and are scoped to the bearer, so a
guessed session id cannot reach another account's rows.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/account/sessions` | `{ "sessions": [...], "currentSessionId": "12" }` |
| `DELETE` | `/api/account/sessions/:id` | `204`, or `404` if already gone |
| `POST` | `/api/account/sessions/revoke-others` | Keeps the caller's session |

A session is one row in `refresh_tokens`. Because the plaintext token is never
recoverable, sessions are identified by the device label, user-agent and IP captured at
sign-in. `currentSessionId` comes from the `sid` claim on the access token, so the
client does not have to guess which row it is.

Refresh rotation preserves the device metadata on the replacement row, so a rotated
session does not reappear as "Unknown device", and `last_seen_at` reflects the most
recent use rather than the original sign-in.

### Cloud accounts

All of these require `Authorization: Bearer <accessToken>` and are scoped to the
bearer: one user can never read or delete another's rows.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/cloud-accounts/providers` | Provider ids, labels and per-field hints |
| `GET` | `/api/cloud-accounts` | `{ "accounts": [...], "count": n }` |
| `POST` | `/api/cloud-accounts` | `201` with the created account |
| `DELETE` | `/api/cloud-accounts/:id` | `204` |

```json
{
  "provider": "aws",
  "label": "Production",
  "accountRef": "123456789012",
  "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
  "accessKeySecret": "wJalrXUtnFEMI...",
  "region": "us-east-1"
}
```

`provider` is `aws`, `azure` or `gcp`. Field formats are validated per provider (AWS
wants a 12-digit account id and an `AKIA…` key; Azure a subscription UUID and client id;
GCP a project id and service-account email). `422` returns a `details` object keyed by
field so the form can highlight each input.

The stored secret is encrypted with AES-256-GCM (`ENCRYPTION_KEY`) as
`v1:<iv>:<tag>:<ciphertext>` and **never** appears in any response — `accessKeyId` is
returned, `accessKeySecret` is not. Accounts start at `status: "pending"`; nothing yet
calls the provider's API to confirm the credentials work.

### `GET /`

An HTML status page — this is what you see when you open
<http://localhost:4000> in a browser. It runs a live `SELECT` against Postgres and
shows either:

- **Backend is running with database connected**, plus the database name, user,
  server version and round-trip latency, or
- **Backend is running, but the database is not reachable**, with the connection
  error, if the query fails.

It also lists the auth endpoints. The page is static HTML with no JavaScript, and
every interpolated value is escaped.

### `GET /health`

The same check as JSON, for scripts and uptime monitors.

```json
{ "status": "ok", "database": "up", "databaseName": "finops", "latencyMs": 1.7, "uptimeSeconds": 2 }
```

Returns `503` with `{ "status": "degraded", "database": "down" }` when the
database is unreachable.

### Session response shape

```json
{
  "user":    { "id": "1", "name": "Devin Patel", "email": "devin@acme.corp", "createdAt": "2026-10-01T09:16:49.503Z" },
  "access":  { "token": "eyJ...", "tokenType": "Bearer", "expiresIn": 900, "expiresAt": "..." },
  "refresh": { "token": "95CU97...", "expiresAt": "2026-10-02T09:16:49.508Z" },
  "remember": false
}
```

### Error shape

```json
{ "error": { "code": "validation_failed", "message": "Please correct the highlighted fields.", "details": { "email": "Enter a valid email address." } } }
```

`details` is only present for `422`. Codes: `validation_failed`, `invalid_credentials`,
`email_taken`, `unauthorized`, `rate_limited`, `cors_denied`, `bad_json`, `not_found`,
`db_unavailable`, `internal_error`.

---

## Security notes

**Passwords** are hashed with bcrypt at cost 12 (~250 ms). The cost factor is in
`.env` as `BCRYPT_ROUNDS`; the test suite drops it to 4 for speed.

**The 72-byte limit is enforced, not assumed.** bcrypt only reads the first 72 bytes
of a password and silently drops the rest, so two passwords sharing a 72-byte prefix
would both authenticate. Longer passwords are rejected with a 422 rather than
quietly truncated.

**Refresh tokens are opaque, not JWTs.** The client gets 48 random bytes; the database
stores only a SHA-256 digest, so a leaked table dump cannot be replayed as a live
session. Any row can be revoked per device.

**Refresh tokens rotate on every use,** and the revoke-plus-insert happens in one
transaction. A token is single-use, so a thief and the real client cannot both
succeed — whoever loses the race invalidates the other.

**Access tokens carry a `typ` claim** and are verified with a pinned `HS256`
algorithm list, issuer and audience. A refresh token presented as an access token
is rejected rather than accepted with the wrong lifetime.

**Failed sign-ins are indistinguishable.** An unknown email is compared against a
decoy bcrypt hash, so response time does not reveal which addresses are registered,
and both cases return the same `invalid_credentials` message. The frontend's
"Remember me for 30 days" is honoured without this leaking.

**Sign-in and sign-up are rate limited** to 10 attempts per IP per 15 minutes by
default (`RATE_LIMIT_AUTH_MAX`). This is in-memory, so it resets when the process
restarts and is per-instance — move it to Redis before running more than one.

**Input handling.** Every query is parameterised. Bodies are capped at 10 kB. Emails
are trimmed and lowercased so uniqueness is case-insensitive. Names have whitespace
collapsed.

**Errors never leak internals.** Unhandled failures return a generic message; the
underlying error text is only attached in development.

**Headers** come from `helmet` (`nosniff`, CSP, HSTS, `X-Frame-Options`) and
`x-powered-by` is disabled. CORS is an explicit allowlist, and a request from an
unknown origin gets a 403 rather than a 500.

### Before deploying

- [ ] Set `NODE_ENV=production` so stack traces and driver messages stop being returned
- [ ] Rotate both JWT secrets to fresh 32+ character values
- [ ] Replace the dev `POSTGRES_PASSWORD`; Postgres is currently published on `0.0.0.0:5432`
- [ ] Serve over TLS and keep `Strict-Transport-Security` (on by default via `helmet`)
- [ ] Move rate limiting to a shared store once there is more than one instance
- [x] Add email verification
- [x] Add a password reset flow
- [ ] Put avatar uploads on a persistent volume or object storage
- [ ] Move tokens out of `localStorage` into `HttpOnly` cookies
- [x] Validate submitted credentials against each provider's API instead of `status = 'pending'` (AWS Cost Explorer sync moves accounts `pending` → `connected`)
- [x] Ingest costs from AWS Cost Explorer, Azure Cost Management and GCP Cloud Billing (AWS live via Cost Explorer; Azure/GCP via deterministic demo dataset until their SDKs are wired)

---

## Layout

```
src/
├── server.js              entry point: DB check, listen, graceful shutdown
├── app.js                 express wiring: helmet, CORS, rate limits, /health
├── config.js              env parsing with fail-fast validation
├── db.js                  pg pool, query helper, withTransaction
├── statusPage.js          live DB check + the GET / HTML page
├── errors.js              ApiError + the specific errors auth throws
├── validate.js            request parsing and field-level validation
├── tokens.js              JWT signing, refresh token hashing, TTL parsing
├── crypto.js              AES-256-GCM encryption for stored cloud secrets
├── mailer.js              Nodemailer transport, console fallback when unset
├── auth.service.js        queries, bcrypt, session issue/rotate/revoke
├── verification.service.js  6-digit codes: issue, verify, expiry, attempt cap
├── reset.service.js       password-reset codes: issue, redeem, revoke sessions
├── account.service.js     profile + avatar updates, public user shape, sessions
├── cloud.service.js       provider validation and per-user account CRUD
├── routes/
│   ├── auth.js            /signup /verify-email /resend-verification /signin
│   │                      /forgot-password /reset-password /refresh /logout /me
│   │                      plus PATCH /me, avatar upload/removal, /change-password
│   ├── account.js         /sessions, /sessions/:id, /sessions/revoke-others
│   └── cloudAccounts.js   /providers plus per-user cloud account CRUD
└── middleware/
    ├── asyncHandler.js    forwards async rejections to the error handler
    ├── requireAuth.js     Bearer token verification
    ├── upload.js          Multer disk storage, magic-byte image check
    └── errorHandler.js    ApiError -> JSON, plus Postgres and parser cases
db/
├── 001_create_users.sql
├── 002_create_refresh_tokens.sql
├── 003_email_verification_and_cloud_accounts.sql
├── 004_password_reset_codes.sql
├── 005_account_settings.sql
└── migrate.js
test/auth.test.js          auth + email verification tests
test/cloudAccounts.test.js cloud account CRUD and encryption tests
test/passwordReset.test.js forgot-password / reset-password tests
test/account.test.js      profile, avatar, password change, sessions
```

`npm test` runs all four: 151 tests total. Each file uses its own database
(`finops_test`, `finops_test_cloud`, `finops_test_reset`, `finops_test_account`)
because `node --test` runs files in parallel and they truncate `users`. Create them
once with:

```bash
docker exec -it postgres psql -U postgres \
  -c 'CREATE DATABASE finops_test_account;'
```

## Frontend integration

`frontend/` already talks to this API. `frontend/src/api/client.js` holds the token
storage and refresh logic, and Vite proxies `/api` **and `/uploads`** to port 4000 so
the browser sees
one origin:

```js
// frontend/vite.config.js
server: {
  port: 5173,
  open: true,
  proxy: { '/api': 'http://localhost:4000' },
}
```

That proxy keeps CORS out of the picture in dev, and the `CORS_ORIGINS` allowlist stays
meaningful for any other client you add later.

### Email verification behaviour

`POST /api/auth/signup` returns the created user with `emailVerified: false` and no
session. The caller must exchange the emailed code for a session:

1. `POST /api/auth/verify-email` with `{ userId, code }` — on success returns the
   access/refresh pair and marks the address verified.
2. `POST /api/auth/resend-verification` with `{ email }` — issues a fresh code.

Sign-in is refused with `403 email_not_verified` until step 1 succeeds.

Both resend and the unknown-address case return an identical body, so the endpoint
cannot be used to discover which addresses are registered. When `SMTP_HOST` is unset
the code goes to the console instead, and the response carries `devCode` so the
frontend can complete the flow locally. With SMTP configured, `devCode` is never
returned.

### Sending real email

Set the SMTP fields in `.env` and check them before touching the signup flow:

```bash
npm run mail:test              # verifies the connection only
npm run mail:test you@x.com    # also sends a real message
```

The script prints what it is about to use, so a typo is obvious. It exits non-zero
if the credentials are wrong, which is far easier to debug than a failed signup.

**Gmail** requires two-factor auth on the account, then an App Password — the
account password will not work over SMTP:

1. Enable 2FA: <https://myaccount.google.com/security>
2. Create an App Password: <https://myaccount.google.com/apppasswords>
3. Use that 16-character password in `SMTP_PASSWORD`

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASSWORD=<the app password>
MAIL_FROM=CloudPulse <you@gmail.com>
```

`MAIL_FROM` must be on the domain you authenticated with, or SPF/DKIM reject the
message. For a real product use a domain you control (Resend, SendGrid and Mailgun
all work through the same fields). Personal Gmail is fine for development but caps
out around 500 messages a day and shows the code as a security alert.

`SMTP_SECURE=true` is for port 465 implicit TLS. Port 587 upgrades over STARTTLS,
which is why it stays `false`.
