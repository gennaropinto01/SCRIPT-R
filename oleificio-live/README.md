# Oleificio Live

Production-tracking web application for an olive-oil mill (frantoio), for both
internal staff and the customers who deliver olives. Each customer sees, with
their own credentials, the state of their own lot: queue position, current
phase, progress %, an **ETA interval with a confidence level**, estimated/real
oil yield, a synchronised 3D view of the active machine, a timeline, notifications
and documents — and never any other customer's data.

> The decisive component is the **advancement / ETA engine**, not the 3D graphics.
> It simulates the whole line (batch vs continuous phases, queue, downtime, vat
> occupancy) instead of dividing weight by throughput.

## Status

This repository is being built in the ordered phases from the project brief.

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Analysis & architecture: docs, ADRs, Mermaid diagrams, Prisma schema, monorepo, API spec, **tested ETA engine** | ✅ Delivered |
| 2 | Foundation: DB, auth, tenants, roles, migrations, seed, env | ✅ Implemented (`apps/web`) |
| 3 | Operational backend: customers, deliveries, lots, phases, machines, queue, states, audit, ETA wiring, telemetry (seed), API | ✅ Implemented |
| 4 | Operator dashboard | ✅ Implemented |
| 5 | Customer portal | ✅ Implemented |
| 6 | 3D visualisation (procedural R3F + 2D fallback) | ✅ Implemented |
| 7 | Tests & hardening | ◐ Core done (engine + state-machine tests, RBAC/tenant isolation verified); full E2E/monitoring pending |

The **running application** is in `apps/web` — see its README to start it.
`docs/` holds the full Phase 1 architecture set.

## Phase 1 deliverables

- `docs/assumptions.md` — assumptions + **data the mill must provide** + DEMO time model
- `docs/architecture.md` — layered architecture, monorepo layout, realtime flow (Mermaid)
- `docs/domain-model.md` — process, **lot & phase state machines**, ER diagram, events (Mermaid)
- `docs/security-model.md` — RBAC, tenant isolation, credentials, privacy
- `docs/eta-engine.md` — the advancement model, formulas, confidence, calibration
- `docs/telemetry-integration.md` — `TelemetryProvider` abstraction, providers, freshness
- `docs/api-spec.md` — concrete REST + WebSocket endpoints
- `docs/adr/` — architecture decision records
- `prisma/schema.prisma` — initial database schema (all Phase-1 entities)
- `packages/eta-engine/` — **runnable, tested** advancement engine

## The ETA engine (runnable now)

```bash
cd oleificio-live
pnpm install
pnpm --filter @oleificio/eta-engine test        # 18 tests
pnpm --filter @oleificio/eta-engine typecheck
```

Covered cases include the brief's mandatory ones: 500 kg on a 1000 kg/h machine
= 30 min; gramolazione split into batches; two 400 kg vats vs one 800 kg vat;
machine stopped mid-phase; priority change; telemetry absent/stale; ETA interval
widening with lower confidence; calibration gated by minimum observations.

## Local development stack

```bash
docker compose up -d          # postgres + redis + minio
cp .env.example .env
```

## Important caveats

- Values marked `DEMO` are placeholders and **must not be shown to customers as
  promises** without calibration against the real mill.
- Real PLC/sensor mappings (registers, MQTT topics, OPC UA nodes) are **not
  invented** — they are per-tenant configuration supplied by the machine maker.
  Manual mode always works without any sensor.
