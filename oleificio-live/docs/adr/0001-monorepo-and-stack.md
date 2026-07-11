# ADR 0001 — Monorepo & technology stack

- **Status:** Accepted (Phase 1)
- **Date:** 2026-07-11

## Context
We need a production-ready web app for both mill staff and customers, with live
updates, a 3D view, multitenancy and an auditable advancement engine.

## Decision
- **TypeScript monorepo** (pnpm workspaces) with strict mode; no `any` without a
  documented reason.
- **Frontend:** Next.js (App Router), React, Tailwind, TanStack Query, React Hook
  Form, Zod, React Three Fiber + Drei, WebSocket/SSE, installable PWA.
- **Backend:** modular NestJS-style API server, REST + OpenAPI, WebSocket gateway,
  PostgreSQL + Prisma, Redis (cache/pubsub), BullMQ (jobs/notifications),
  S3-compatible object storage.
- **Layering:** domain / application / infrastructure / interface kept separate.
- Domain and the ETA engine are framework-free packages, independently testable.

## Consequences
- Shared types (Zod schemas, domain events) live once in `packages/`.
- The ETA engine and state machine are unit-testable without a database.
- Versions are pinned at implementation time to current stable releases.
