# Assumptions & Open Questions — Oleificio Live

> **Status:** Phase 1 (Analysis & Architecture).
> This document records the assumptions made where the brief left room for
> interpretation, and — critically — the **real data that the mill must
> provide** before the software can be connected to a physical plant. Any value
> marked `DEMO` is a placeholder for demonstration only and **must not be shown
> to a customer as a promise** without calibration.

## 1. Assumptions taken

| # | Area | Assumption | Rationale |
|---|------|-----------|-----------|
| A1 | Time model | No single universal phase duration exists. All continuous phases derive time from **effective** kg/h capacity; batch phases (esp. gramolazione) derive time from **per-batch duration × number of batches**. | Explicit requirement in the brief. |
| A2 | Gramolazione | Modelled as a **batch** phase. A lot larger than the malaxer capacity is split into `ceil(weight / batchCapacity)` batches, each with its own configured duration. Two 400 kg vats ≠ one 800 kg vat. | Explicit requirement. |
| A3 | Capacity | Each machine stores its own nominal and effective capacity. There is no global constant. | Explicit requirement. |
| A4 | ETA output | Always an **interval** `[low, high]` plus a confidence level, never a single artificially precise time. Confidence downgrades when inputs are incomplete or telemetry is stale. | Explicit requirement. |
| A5 | Efficiency | `effectiveCapacity = nominalCapacity × efficiencyFactor`. `efficiencyFactor` starts at a configured value and is refined by the calibration engine using **weighted** averages with a minimum-observations gate. | Explicit requirement. |
| A6 | Queue | FIFO is the default. Priority (`NORMAL`/`HIGH`/`URGENT`) and manual reorder are allowed but require a mandatory reason and trigger ETA recalculation + customer notification. | Explicit requirement. |
| A7 | Tenancy | Every operational row carries `tenantId`. Cross-tenant access is denied at the query, service, API, WebSocket, job, storage and audit layers — not only in the UI. | Explicit requirement. |
| A8 | Telemetry | The system runs fully in **manual mode** when no sensor is present. Telemetry, when present, overrides time-based progress. | Explicit requirement. |
| A9 | PLC mapping | Registers, MQTT topics and OPC UA node IDs are **never invented**. Provider interfaces are prepared; concrete mappings are per-tenant configuration supplied by the machine manufacturer. | Explicit requirement. |
| A10 | Stack | TypeScript monorepo. Backend API server (NestJS-style modular). Next.js App Router frontend. PostgreSQL + Prisma, Redis, BullMQ, S3-compatible object storage. React Three Fiber for 3D. | Recommended in the brief; adopted. |
| A11 | Concurrency | Optimistic locking via a `version` column on mutable operational entities (`OliveLot`, `LotPhase`, `Machine`, `QueueEntry`). Critical multi-row operations run in DB transactions. | "Two operators editing the same lot" test case. |
| A12 | Customer isolation | Customer-facing API responses are built from customer-scoped queries; no other customer's identifying data ever appears in a payload. | Explicit requirement. |
| A13 | Credentials | Customers may have **no email**. In that case: generated username + temporary password + printable access sheet + QR code that opens **only** the login/activation page (no permanent token embedded). | Explicit requirement. |
| A14 | Passwords | Stored only as Argon2id hashes. Temporary passwords expire and force a change on first login. Never emailed/printed in permanent plaintext form. | Explicit requirement. |
| A15 | Audit | Append-only audit log; every state transition emits an immutable domain event with `previousState`/`newState`. | Explicit requirement. |
| A16 | Accessibility | Target WCAG 2.2 AA. 3D state also described textually; `prefers-reduced-motion` respected; 2D fallback when WebGL is unavailable. Default language Italian, i18n-ready. | Explicit requirement. |

## 2. Data the mill MUST provide before real connection

These cannot be guessed. Until supplied, the app runs with `DEMO` values and
labels them as such in the admin UI.

1. **Machine models** and identifiers per stage.
2. **Nominal and effective throughput** (kg/h) per machine.
3. **Number and capacity of malaxers (gramole)** — batch capacity in kg.
4. Whether **parallel processing** is possible per stage, and how many concurrent lots/batches.
5. **Setup, transfer, drain and cleaning times** per machine/stage.
6. Available **PLC protocol** (OPC UA / Modbus TCP / MQTT / HTTP) and the manufacturer's **register/topic/node map**.
7. **Lot separation rules** (contamination avoidance, organic vs conventional, cultivar grouping).
8. **Historical durations** for calibration seeding.

## 3. DEMO time model (initial, editable, NOT a customer promise)

| Stage | DEMO basis |
|-------|-----------|
| Acceptance & weighing | 5–15 min fixed |
| Defoliation & washing | computed from kg/h |
| Crushing (frangitura) | computed from kg/h |
| Malaxing (gramolazione) | **30–45 min per batch** (batch model) |
| Decanter extraction | computed from kg/h |
| Vertical separation | computed from kg/h |
| Filtration (optional) | computed from kg/h |
| Final prep | 5–20 min fixed |

The gramolazione technical range cited in the brief is ~20–75 min depending on
cultivar, ripeness, temperature, paste characteristics and mill settings; the
30–45 min DEMO value sits inside that range and is configurable per tenant.

## 4. Explicitly out of scope for Phase 1

- Full 3D asset production (Phase 6).
- Real PLC driver implementations beyond Manual/Mock/HTTP (interfaces only).
- Production hardening / monitoring wiring (Phase 7).
