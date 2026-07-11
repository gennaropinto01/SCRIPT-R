import type { MachineConfig, StageConfig } from "./types.js";

const MINUTES_PER_HOUR = 60;

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** effectiveCapacity = nominalCapacity * efficiencyFactor (fallback to stored effective). */
export function effectiveCapacityKgPerHour(machine: MachineConfig): number | undefined {
  if (typeof machine.nominalCapacityKgPerHour === "number") {
    return machine.nominalCapacityKgPerHour * machine.efficiencyFactor;
  }
  if (typeof machine.effectiveCapacityKgPerHour === "number") {
    return machine.effectiveCapacityKgPerHour;
  }
  return undefined;
}

/**
 * Continuous phase:
 *   processing = weight / effectiveCapacity * 60
 *   total      = setup + processing + cleanup
 * Throws if capacity is unknown — the caller decides how to degrade confidence.
 */
export function continuousPhaseMinutes(
  weightKg: number,
  stage: StageConfig,
  machine: MachineConfig,
): number {
  const capacity = effectiveCapacityKgPerHour(machine);
  if (!capacity || capacity <= 0) {
    throw new Error(`Unknown effective capacity for machine ${machine.id}`);
  }
  const processing = (weightKg / capacity) * MINUTES_PER_HOUR;
  return stage.setupMinutes + processing + stage.cleanupMinutes;
}

/**
 * Number of batches for a batch phase. A lot larger than the vat is split.
 */
export function numberOfBatches(weightKg: number, batchCapacityKg: number): number {
  if (batchCapacityKg <= 0) throw new Error("batchCapacityKg must be > 0");
  return Math.max(1, Math.ceil(weightKg / batchCapacityKg));
}

/**
 * Batch phase (e.g. gramolazione). Uses per-batch duration, NOT kg/h.
 * With parallelBatchCount > 1, batches run in parallel waves:
 *   waves = ceil(batches / parallelBatchCount)
 *   total = setup + waves * avgBatchDuration + cleanup
 *
 * This is why two 400 kg vats differ from one 800 kg vat downstream: the vat
 * count and parallelism change how soon the machine frees for the next lot.
 */
export function batchPhaseMinutes(
  weightKg: number,
  stage: StageConfig,
  machine: MachineConfig,
): { minutes: number; batches: number } {
  if (!machine.batchCapacityKg || machine.batchCapacityKg <= 0) {
    throw new Error(`Unknown batch capacity for machine ${machine.id}`);
  }
  const avg = stage.averageBatchDurationMinutes;
  if (!avg || avg <= 0) {
    throw new Error(`Unknown average batch duration for stage ${stage.code}`);
  }
  const batches = numberOfBatches(weightKg, machine.batchCapacityKg);
  const parallel = Math.max(1, machine.parallelBatchCount);
  const waves = Math.ceil(batches / parallel);
  const minutes = stage.setupMinutes + waves * avg + stage.cleanupMinutes;
  return { minutes, batches };
}

/**
 * Progress within the active phase. Telemetry overrides elapsed-time basis when
 * fresh and trustworthy. Result clamped to [0, 1] — also used as animationProgress.
 */
export function phaseProgress(
  elapsedMinutes: number,
  estimatedMinutes: number,
  telemetry?: {
    progressFraction: number;
    ageSeconds: number;
    staleThresholdSeconds: number;
    quality: "GOOD" | "UNCERTAIN" | "BAD";
  },
): number {
  if (
    telemetry &&
    telemetry.quality !== "BAD" &&
    telemetry.ageSeconds <= telemetry.staleThresholdSeconds
  ) {
    return clamp(telemetry.progressFraction, 0, 1);
  }
  if (estimatedMinutes <= 0) return 0;
  return clamp(elapsedMinutes / estimatedMinutes, 0, 1);
}
