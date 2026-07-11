# Security & Privacy Model — Oleificio Live

## 1. Roles (RBAC)

| Role | Scope | Capabilities (summary) |
|------|-------|------------------------|
| **Super Admin** | Global | Manage tenants (mills), create admins, global config, audit logs, global stats, suspend accounts, security config. |
| **Mill Admin** | One tenant | Configure plant/machines/capacities, create operators, register customers, generate credentials, manage lots/queue, downtimes, correct times, upload docs, reports, notifications. |
| **Operator** | One tenant | Register arrivals, weigh, assign lots, advance phases, start/pause/complete processing, flag anomalies, enter temp/weight/yield, associate machine, read telemetry. |
| **Customer** | Own data | View only own deliveries/lots/status/timeline/3D/notifications/authorized docs/final summary/yield. |

Permissions are stored (`Role`→`Permission`) and enforced by a guard on every
route, WebSocket subscription and background job.

## 2. Tenant isolation

Every operational row has `tenantId`. Isolation is enforced at **every** layer,
not just the UI:

- **Queries:** repository base layer injects `tenantId`; no raw unscoped query.
- **Services / use-cases:** receive a `TenantContext`; cross-tenant IDs rejected.
- **API:** tenant derived from the authenticated principal, never from client input.
- **WebSocket:** subscriptions are scoped to `tenant:{id}` and, for customers,
  `customer:{id}` rooms.
- **Jobs:** every BullMQ job payload carries and re-checks `tenantId`.
- **Files:** object keys are prefixed `tenant/{id}/…`; signed URLs are short-lived.
- **Audit:** audit entries are tenant-scoped and append-only.
- **Tests:** dedicated tenant-isolation tests (customer A cannot read lot of
  customer B; admin of tenant X cannot reach tenant Y).

## 3. Authentication & customer credentials

- Username **or** email.
- Randomly generated **temporary password**, hashed with **Argon2id**; forced
  change on first login; temporary password **expires**.
- Passwords **never** stored or transmitted as permanent plaintext.
- Revocable sessions; **rotated** refresh tokens; logout-from-all-devices.
- Login attempt limiting + brute-force protection (`LoginAttempt`).
- Credential recovery; optional 2FA for admins; access auditing; account disable.
- **No-email customers:** generated username + printable access sheet + temporary
  password + **QR code that opens only the login/activation page** — no permanent
  token embedded in the QR.

## 4. Transport & app security

- Secure, `HttpOnly`, `SameSite` cookies for session/refresh where applicable.
- CSRF protection on state-changing browser requests.
- Content Security Policy; strict CORS.
- Rate limiting on auth and mutating endpoints.
- Server-side validation + input sanitisation on **every** endpoint (Zod).
- Upload protection: file-type sniffing, size limits, stored in S3 with signed,
  temporary URLs; never served from app origin directly.
- Secrets from environment / secret manager; encrypted at rest; never logged.

## 5. Privacy (GDPR-aligned)

- Structured logs contain **no passwords or PII**.
- Append-only audit log with retention policy.
- Data export; deletion/anonymisation per authorization.
- Separate consent for notifications (`NotificationPreference`).
- Rights handling (access/rectification/erasure) surfaced to admins.
- Backup & restore procedures documented.
- **API responses never include another customer's identifying data.** Filtering
  is done in the query, not only the frontend.

## 6. Concurrency & integrity

- Optimistic locking (`version`) on mutable operational entities; conflicting
  writes get a 409 and the client re-reads.
- DB transactions for critical multi-row operations (accept, advance phase,
  reorder queue, record output).
- Every significant change is verifiable in the audit log.

## 7. Threat cases covered by tests

Customer accessing another customer's lot · admin crossing tenants · brute-force
login · concurrent lot edits · replayed/duplicated notification · stale telemetry
trust · unsigned/oversized upload.
