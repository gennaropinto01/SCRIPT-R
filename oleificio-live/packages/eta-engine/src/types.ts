/**
 * ETA engine types — the advancement model.
 *
 * The engine simulates the whole line rather than dividing weight by throughput.
 * All durations are in minutes; all timestamps are epoch milliseconds so the
 * engine stays pure and framework-free.
 */

export type StageType = "CONTINUOUS" | "BATCH";
export type EtaConfidence = "LOW" | "MEDIUM" | "HIGH";
export type LotPriority = "NORMAL" | "HIGH" | "URGENT";

export interface StageConfig {
  id: string;
  code: string;
  orderIndex: number;
  stageType: StageType;
  isEnabled: boolean;
  isOptional: boolean;
  requiresPreviousStage: boolean;
  setupMinutes: number;
  cleanupMinutes: number;
  /** Minutes of overlap allowed with the next stage (0 = strictly sequential). */
  overlapMinutes: number;
  allowsParallelProcessing: boolean;
  /** For continuous phases. */
  averageMinutes?: number;
  minMinutes?: number;
  maxMinutes?: number;
  /** For batch phases (e.g. gramolazione). */
  averageBatchDurationMinutes?: number;
}

export interface MachineConfig {
  id: string;
  /** Stage this machine serves in the simulated line. */
  stageId: string;
  nominalCapacityKgPerHour?: number;
  effectiveCapacityKgPerHour?: number;
  efficiencyFactor: number;
  batchCapacityKg?: number;
  parallelBatchCount: number;
  /** Whether calibration has reached the minimum-observations gate. */
  calibrated: boolean;
  /** Downtime windows as [startMs, endMs]; endMs may be Infinity if ongoing. */
  downtimes?: Array<[number, number]>;
}

export interface LotInput {
  id: string;
  weightKg: number;
  priority: LotPriority;
  /** When the lot becomes available to start (arrival/accept time), epoch ms. */
  availableAtMs: number;
}

export interface TelemetrySignal {
  /** Fresh progress fraction 0..1 for the active phase, if telemetry is live. */
  progressFraction: number;
  ageSeconds: number;
  staleThresholdSeconds: number;
  quality: "GOOD" | "UNCERTAIN" | "BAD";
}

export interface PhaseSchedule {
  lotId: string;
  stageId: string;
  machineId: string;
  startMs: number;
  endMs: number;
  estimatedMinutes: number;
  numberOfBatches?: number;
}

export interface LotSchedule {
  lotId: string;
  estimatedStartMs: number;
  estimatedCompletionMs: number;
  phases: PhaseSchedule[];
  confidence: EtaConfidence;
}

export interface EtaWindow {
  lowMs: number;
  highMs: number;
  confidence: EtaConfidence;
  /** Fractional spread applied to build the interval, for transparency. */
  spread: number;
}
