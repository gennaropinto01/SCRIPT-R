# ADR 0003 — Multitenancy & defense-in-depth isolation

- **Status:** Accepted (Phase 1)
- **Date:** 2026-07-11

## Context
The platform hosts multiple mills (tenants). A customer must never see another
customer's data; a mill admin must never reach another tenant. UI filtering is
insufficient.

## Decision
- Every operational row carries `tenantId`.
- Isolation enforced at query, service, API, WebSocket, job, storage and audit
  layers. Tenant is derived from the authenticated principal, never client input.
- RBAC guard + tenant guard on every route and subscription.
- Customer API responses are built from customer-scoped queries only.
- Optimistic locking (`version`) + DB transactions for critical operations.
- Passwords: Argon2id; temporary passwords expire and force change; refresh
  tokens rotate; sessions revocable. No-email customers get username + printable
  sheet + QR that opens only the login/activation page (no embedded token).

## Consequences
- Dedicated cross-tenant and cross-customer denial tests are mandatory.
- Repositories expose no unscoped query path.
