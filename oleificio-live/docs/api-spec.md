# API Specification — Oleificio Live

REST is documented with OpenAPI at runtime (`/api/docs`). All endpoints are
tenant-scoped from the authenticated principal; mutating endpoints validate with
Zod and enforce RBAC. Times are ISO-8601. Money/quantities are explicit units.

## Conventions

- Auth: `Authorization: Bearer <accessToken>`; refresh via rotating token.
- Errors: `{ error: { code, message, details? } }`, correct HTTP status.
- Optimistic locking: mutating lot/machine/queue calls accept `If-Match: <version>`
  (or `version` in body); mismatch → `409 Conflict`.
- Pagination: `?page=&pageSize=`, response `{ data, page, pageSize, total }`.

## Auth

| Method | Path | Role | Body / Notes |
|--------|------|------|--------------|
| POST | `/api/auth/login` | public | `{ identifier, password }` → access + refresh; flags `mustChangePassword`. |
| POST | `/api/auth/activate` | public | `{ activationToken, newPassword }` first-login password set. |
| POST | `/api/auth/refresh` | public | rotates refresh token. |
| POST | `/api/auth/logout` | auth | revokes current session. |
| POST | `/api/auth/logout-all` | auth | revokes all sessions. |
| POST | `/api/auth/forgot` | public | starts credential recovery. |

## Customer (own data only)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/customer/deliveries` | own deliveries |
| GET | `/api/customer/lots` | own lots (summary) |
| GET | `/api/customer/lots/:lotId` | own lot detail (no other-customer data) |
| GET | `/api/customer/lots/:lotId/progress` | current stage, `progressPercentage`, ETA interval, confidence, `lastUpdatedAt` |
| GET | `/api/customer/lots/:lotId/timeline` | ordered phases with status/timestamps |
| GET | `/api/customer/lots/:lotId/documents` | authorized documents (signed URLs) |
| GET | `/api/customer/notifications` | own notifications |
| POST | `/api/customer/notifications/:id/read` | mark read |
| GET | `/api/customer/lots/:lotId/summary` | final: kg olives, oil L/kg, yield %, containers, pickup status |

## Operator

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/operator/deliveries` | register arrival + weighing |
| POST | `/api/operator/lots` | create lot from delivery |
| POST | `/api/operator/lots/:lotId/phases/:phaseId/start` | start phase (tx + ETA recompute) |
| POST | `/api/operator/lots/:lotId/phases/:phaseId/pause` | pause |
| POST | `/api/operator/lots/:lotId/phases/:phaseId/resume` | resume |
| POST | `/api/operator/lots/:lotId/phases/:phaseId/complete` | complete + advance |
| POST | `/api/operator/lots/:lotId/anomaly` | flag anomaly / block |
| POST | `/api/operator/lots/:lotId/quality` | temperature, weight, readings |
| POST | `/api/operator/lots/:lotId/oil-output` | record oil produced → yield |
| POST | `/api/operator/lots/:lotId/assign-machine` | associate machine |
| PATCH | `/api/operator/lots/:lotId/times` | authorized time correction (audited) |

Critical operations (cancel lot, edit weight, edit yield, skip phase, reopen
completed phase, reassign customer, priority move) require explicit confirmation
and a mandatory reason; all audited.

## Admin (mill)

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/admin/machines` | list/create machines + capacities |
| PATCH | `/api/admin/machines/:machineId/status` | set status |
| GET/POST/PATCH | `/api/admin/stages` | configure processing stages |
| GET | `/api/admin/production-queue` | queue with ETAs |
| PATCH | `/api/admin/production-queue/reorder` | reorder (reason required, ETA sim, notify) |
| POST | `/api/admin/downtimes` | insert machine downtime |
| POST | `/api/admin/customers` | register customer |
| POST | `/api/admin/customers/:id/credentials` | generate credentials (+ QR/print sheet) |
| POST | `/api/admin/documents` | upload document |
| GET | `/api/admin/reports/*` | reports (CSV/PDF export) |
| GET | `/api/admin/calibration` | estimated vs actual, efficiency history |
| GET | `/api/admin/audit-log` | append-only audit view |

## Super Admin

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/superadmin/tenants` | manage mills |
| POST | `/api/superadmin/admins` | create mill admins |
| GET | `/api/superadmin/audit-log` | global audit |
| GET | `/api/superadmin/stats` | global statistics |
| POST | `/api/superadmin/accounts/:id/suspend` | suspend account |

## WebSocket events (tenant/customer scoped rooms)

`lot.progress.updated` · `lot.phase.changed` · `lot.eta.updated` ·
`lot.completed` · `machine.status.changed` · `notification.created`

Payloads carry only data the subscriber is authorized to see. Customer rooms
never receive other customers' lots.

## Demo mode

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/demo/run` | start accelerated simulated lot lifecycle |
| POST | `/api/demo/control` | `{ action: play|pause|speed|stop_machine|restore_machine|delay|complete_phase, speed?: 1|5|20 }` |
