import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  batchPhaseMinutes,
  continuousPhaseMinutes,
  numberOfBatches,
  phaseProgress,
  simulateLine,
  toEtaWindow,
  updateEfficiencyFactor,
  type LotInput,
  type MachineConfig,
  type StageConfig,
} from "../src/index.js";

const T0 = 1_700_000_000_000; // fixed "now"

function contStage(over: Partial<StageConfig> = {}): StageConfig {
  return {
    id: "s-crush",
    code: "CRUSHING",
    orderIndex: 1,
    stageType: "CONTINUOUS",
    isEnabled: true,
    isOptional: false,
    requiresPreviousStage: true,
    setupMinutes: 0,
    cleanupMinutes: 0,
    overlapMinutes: 0,
    allowsParallelProcessing: false,
    averageMinutes: 30,
    ...over,
  };
}

function batchStage(over: Partial<StageConfig> = {}): StageConfig {
  return {
    id: "s-malax",
    code: "MALAXING",
    orderIndex: 2,
    stageType: "BATCH",
    isEnabled: true,
    isOptional: false,
    requiresPreviousStage: true,
    setupMinutes: 0,
    cleanupMinutes: 0,
    overlapMinutes: 0,
    allowsParallelProcessing: false,
    averageBatchDurationMinutes: 40,
    ...over,
  };
}

function machine(over: Partial<MachineConfig> = {}): MachineConfig {
  return {
    id: "m1",
    stageId: "s-crush",
    nominalCapacityKgPerHour: 1000,
    efficiencyFactor: 1,
    parallelBatchCount: 1,
    calibrated: true,
    ...over,
  };
}

// --- Brief case: 500 kg on a 1000 kg/h machine → 30 minutes continuous ---
test("continuous: 500 kg @ 1000 kg/h = 30 min", () => {
  const mins = continuousPhaseMinutes(500, contStage(), machine());
  assert.equal(mins, 30);
});

test("continuous adds setup + cleanup", () => {
  const mins = continuousPhaseMinutes(
    500,
    contStage({ setupMinutes: 5, cleanupMinutes: 10 }),
    machine(),
  );
  assert.equal(mins, 45);
});

test("effective capacity applies efficiencyFactor", () => {
  // efficiency 0.5 halves capacity → doubles time
  const mins = continuousPhaseMinutes(500, contStage(), machine({ efficiencyFactor: 0.5 }));
  assert.equal(mins, 60);
});

// --- Brief case: gramolazione as batch, split into multiple batches ---
test("numberOfBatches splits a lot larger than the vat", () => {
  assert.equal(numberOfBatches(800, 400), 2);
  assert.equal(numberOfBatches(801, 400), 3);
  assert.equal(numberOfBatches(300, 400), 1);
});

test("batch phase: 800 kg in one 800 kg vat = 40 min (1 batch)", () => {
  const m = machine({ id: "mv1", stageId: "s-malax", batchCapacityKg: 800, parallelBatchCount: 1 });
  const r = batchPhaseMinutes(800, batchStage(), m);
  assert.equal(r.batches, 1);
  assert.equal(r.minutes, 40);
});

test("batch phase: 800 kg in two 400 kg parallel vats = 40 min (1 wave)", () => {
  const m = machine({ id: "mv2", stageId: "s-malax", batchCapacityKg: 400, parallelBatchCount: 2 });
  const r = batchPhaseMinutes(800, batchStage(), m);
  assert.equal(r.batches, 2);
  assert.equal(r.minutes, 40); // 1 wave of 2 parallel batches
});

test("batch phase: 800 kg in two 400 kg sequential vats = 80 min (2 waves)", () => {
  const m = machine({ id: "mv3", stageId: "s-malax", batchCapacityKg: 400, parallelBatchCount: 1 });
  const r = batchPhaseMinutes(800, batchStage(), m);
  assert.equal(r.batches, 2);
  assert.equal(r.minutes, 80); // sequential: two 40-min batches
});

// --- Progress & telemetry override ---
test("phaseProgress falls back to elapsed/estimated and clamps", () => {
  assert.equal(phaseProgress(15, 30), 0.5);
  assert.equal(phaseProgress(45, 30), 1); // clamped
  assert.equal(phaseProgress(-5, 30), 0); // clamped
});

test("fresh telemetry overrides time basis", () => {
  const p = phaseProgress(15, 30, {
    progressFraction: 0.8,
    ageSeconds: 10,
    staleThresholdSeconds: 60,
    quality: "GOOD",
  });
  assert.equal(p, 0.8);
});

test("stale telemetry is ignored, falls back to time", () => {
  const p = phaseProgress(15, 30, {
    progressFraction: 0.8,
    ageSeconds: 120,
    staleThresholdSeconds: 60,
    quality: "GOOD",
  });
  assert.equal(p, 0.5);
});

// --- Line simulation: queue awareness ---
test("simulateLine schedules two lots sequentially on one machine", () => {
  const stages = [contStage()];
  const machines = [machine()];
  const lots: LotInput[] = [
    { id: "L1", weightKg: 500, priority: "NORMAL", availableAtMs: T0 },
    { id: "L2", weightKg: 500, priority: "NORMAL", availableAtMs: T0 },
  ];
  const sched = simulateLine(lots, stages, machines, T0);
  const l1 = sched.find((s) => s.lotId === "L1")!;
  const l2 = sched.find((s) => s.lotId === "L2")!;
  // L1: 30 min; L2 waits for the machine → starts at +30, ends at +60
  assert.equal(l1.estimatedCompletionMs, T0 + 30 * 60_000);
  assert.equal(l2.estimatedStartMs, T0 + 30 * 60_000);
  assert.equal(l2.estimatedCompletionMs, T0 + 60 * 60_000);
});

test("URGENT priority jumps the queue", () => {
  const stages = [contStage()];
  const machines = [machine()];
  const lots: LotInput[] = [
    { id: "L1", weightKg: 500, priority: "NORMAL", availableAtMs: T0 },
    { id: "L2", weightKg: 500, priority: "URGENT", availableAtMs: T0 },
  ];
  const sched = simulateLine(lots, stages, machines, T0);
  const l2 = sched.find((s) => s.lotId === "L2")!;
  assert.equal(l2.estimatedStartMs, T0); // urgent starts first
});

test("machine downtime pushes the start", () => {
  const stages = [contStage()];
  const down: [number, number] = [T0, T0 + 20 * 60_000];
  const machines = [machine({ downtimes: [down] })];
  const lots: LotInput[] = [
    { id: "L1", weightKg: 500, priority: "NORMAL", availableAtMs: T0 },
  ];
  const sched = simulateLine(lots, stages, machines, T0);
  const l1 = sched[0]!;
  assert.equal(l1.estimatedStartMs, T0 + 20 * 60_000);
  assert.equal(l1.confidence, "MEDIUM"); // downtime lowers confidence
});

test("missing capacity degrades confidence to LOW, no crash", () => {
  const stages = [contStage()];
  const machines = [machine({ nominalCapacityKgPerHour: undefined, effectiveCapacityKgPerHour: undefined })];
  const lots: LotInput[] = [
    { id: "L1", weightKg: 500, priority: "NORMAL", availableAtMs: T0 },
  ];
  const sched = simulateLine(lots, stages, machines, T0);
  assert.equal(sched[0]!.confidence, "LOW");
});

test("full line: crushing (continuous) then malaxing (batch) is additive", () => {
  const stages = [contStage(), batchStage()];
  const machines = [
    machine({ id: "mc", stageId: "s-crush" }),
    machine({ id: "mm", stageId: "s-malax", batchCapacityKg: 400, parallelBatchCount: 1 }),
  ];
  const lots: LotInput[] = [
    { id: "L1", weightKg: 800, priority: "NORMAL", availableAtMs: T0 },
  ];
  const sched = simulateLine(lots, stages, machines, T0);
  const l1 = sched[0]!;
  // crushing: 800/1000*60 = 48 min; malaxing: 2 sequential batches * 40 = 80 min
  const totalMin = (l1.estimatedCompletionMs - l1.estimatedStartMs) / 60_000;
  assert.equal(totalMin, 48 + 80);
});

// --- ETA interval + confidence ---
test("toEtaWindow widens the interval as confidence drops", () => {
  const completion = T0 + 60 * 60_000;
  const hi = toEtaWindow(completion, T0, "HIGH");
  const lo = toEtaWindow(completion, T0, "LOW");
  const hiWidth = hi.highMs - hi.lowMs;
  const loWidth = lo.highMs - lo.lowMs;
  assert.ok(loWidth > hiWidth);
});

// --- Calibration gate ---
test("calibration does not apply below the minimum observations", () => {
  const r = updateEfficiencyFactor({
    priorEfficiency: 1,
    observations: [{ estimatedMinutes: 30, actualMinutes: 33 }],
    minObservations: 5,
  });
  assert.equal(r.applied, false);
  assert.equal(r.newEfficiencyFactor, 1);
});

test("calibration blends toward observed efficiency once gated", () => {
  // machine consistently slower than assumed (took 40 vs 30) → efficiency < 1
  const obs = Array.from({ length: 6 }, () => ({ estimatedMinutes: 30, actualMinutes: 40 }));
  const r = updateEfficiencyFactor({
    priorEfficiency: 1,
    observations: obs,
    minObservations: 5,
  });
  assert.equal(r.applied, true);
  assert.ok(r.newEfficiencyFactor < 1);
  assert.ok(r.newEfficiencyFactor > 0.3);
});
