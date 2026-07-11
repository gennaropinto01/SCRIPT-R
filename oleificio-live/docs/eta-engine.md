# ETA Engine — the advancement model

> This is the decisive part of the product. It does **not** divide weight by
> throughput and call it done: it **simulates the whole line**, phase by phase,
> respecting batch vs continuous behaviour, queue position, machine state and
> telemetry. The reference implementation lives in `packages/eta-engine`.

## 1. Principles

1. **No universal fixed duration.** Every estimate is derived from the specific
   machine's effective capacity and the specific stage's configuration.
2. **Batch ≠ continuous.** Gramolazione is a batch phase driven by per-batch
   duration and number of batches, not by kg/h.
3. **Whole-line simulation.** A lot's completion time depends on every prior lot
   in the queue and on stage overlap, not just its own weight.
4. **Interval, not false precision.** Output is `[low, high]` + a confidence
   level. Confidence drops with incomplete inputs or stale telemetry.
5. **Telemetry overrides time.** When live progress is available and fresh, it
   replaces elapsed-time-based progress.
6. **Explainable.** Each computation persists its inputs so it can be audited.

## 2. Core formulas

### Continuous phase
```
effectiveCapacityKgPerHour = nominalCapacityKgPerHour * efficiencyFactor
processingMinutes          = quantityKg / effectiveCapacityKgPerHour * 60
estimatedPhaseMinutes      = setupMinutes + processingMinutes + cleanupMinutes
```

### Batch phase (e.g. gramolazione)
```
numberOfBatches       = ceil(quantityKg / batchCapacityKg)
estimatedPhaseMinutes = setupMinutes
                      + numberOfBatches * averageBatchDurationMinutes
                      + cleanupMinutes
```
With `parallelBatchCount > 1`, batches run in parallel groups:
```
batchWaves            = ceil(numberOfBatches / parallelBatchCount)
estimatedPhaseMinutes = setupMinutes
                      + batchWaves * averageBatchDurationMinutes
                      + cleanupMinutes
```

> **Why the distinction matters (from the brief):** two 400 kg vats vs one
> 800 kg vat give *different* schedules. With `batchCapacity = 400`,
> `parallelBatchCount = 2` and `avgBatch = 40 min`, an 800 kg lot is 1 wave =
> ~40 min. With a single 800 kg vat (`batchCapacity = 800`,
> `parallelBatchCount = 1`) it is also 1 batch = ~40 min — **but** two 400 kg
> vats let the *next* lot start sooner because vats free independently. The
> simulator models vat occupancy, so these produce different downstream ETAs.

## 3. Progress within the active phase

```
timeBasis      = clamp(elapsedPhaseMinutes / estimatedPhaseMinutes, 0, 1)
progress       = telemetryFresh ? telemetryFraction : timeBasis
```
`animationProgress` for the 3D scene equals `progress`, clamped to `[0,1]`.

## 4. Line simulation (queue-aware)

For each machine we keep a **free-at** timeline. Processing a queued lot:

```
for stage in enabledStagesInOrder:
    machine   = pickEligibleMachine(stage, lot)      # capability + capacity
    readyAt   = max(lotAvailableAt, machine.freeAt)  # respects dependencies
    duration  = stageType == BATCH
                  ? batchDuration(lot, machine, stage)
                  : continuousDuration(lot, machine, stage)
    startAt   = readyAt
    endAt     = startAt + duration
    machine.freeAt = endAt + (allowsOverlap ? -overlapMinutes : 0)
    lotAvailableAt = allowsOverlap ? startAt + overlapMinutes : endAt
lot.estimatedCompletionAt = endAt of last stage
```

Priority (`URGENT` > `HIGH` > `NORMAL`) and manual reorder change the order in
which lots claim machine time. Downtimes push `machine.freeAt` forward.

## 5. Confidence level

| Level | Conditions |
|-------|-----------|
| `HIGH` | Fresh telemetry OR calibrated efficiency (≥ min observations) AND no active downtime AND stable queue. |
| `MEDIUM` | Time-based estimate with default efficiency, no anomalies. |
| `LOW` | Missing/stale telemetry, recent downtime, phase overrun, or incomplete config (e.g. capacity unknown). |

The customer view never shows a single artificial time; it shows the interval,
the confidence, and the "last updated" timestamp.

## 6. Recomputation triggers

Priority lot added · machine stopped · phase overrun · real capacity changed ·
lot paused · machine restored · effective quantity changed · fresh telemetry ·
queue reordered. Each recompute writes an `EtaCalculation` row.

## 7. Customer-facing example

> "Il tuo lotto è nella fase di gramolazione."
> "Avanzamento stimato: 62%."
> "Completamento previsto tra le 17:35 e le 17:50."
> "Stima aggiornata alle 16:58."
> "Affidabilità della stima: alta."

## 8. Calibration loop

The calibration engine compares estimated vs actual phase durations and updates
`efficiencyFactor` via a **weighted moving average**, gated by a minimum number
of observations, with full history retained. No uncontrolled jumps.

```
newEfficiency = clamp(
  (priorWeight * priorEfficiency + obsWeight * observedEfficiency)
  / (priorWeight + obsWeight),
  minBound, maxBound)
```
Applied only after `observations >= minObservations`.
