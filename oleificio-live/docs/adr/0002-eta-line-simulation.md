# ADR 0002 — ETA via whole-line simulation, not weight ÷ throughput

- **Status:** Accepted (Phase 1)
- **Date:** 2026-07-11

## Context
The decisive feature is a customer-understandable, trustworthy advancement model.
Dividing lot weight by a fixed throughput is wrong: it ignores batch phases
(gramolazione), queue position, machine downtime, vat occupancy and stage
overlap. Two 400 kg vats produce a different schedule than one 800 kg vat.

## Decision
Model each machine as a resource with a **free-at** timeline and simulate the
full ordered stage list per lot, queue-aware:
- **Continuous** phases: `setup + weight/effectiveCapacity*60 + cleanup`.
- **Batch** phases: `setup + ceil(batches/parallel) * avgBatchDuration + cleanup`.
- Downtimes, priority, reorder and dependencies shift machine availability.
- Output is an **interval + confidence**, never a single false-precise time.
- Telemetry `progress_fraction`, when fresh, overrides elapsed-time progress.
- Every computation is persisted (`EtaCalculation`) for explainability.

## Consequences
- The engine is pure and unit-tested (see `packages/eta-engine`).
- Estimates are auditable and recomputed on defined triggers.
- Confidence communicates uncertainty instead of hiding it.
