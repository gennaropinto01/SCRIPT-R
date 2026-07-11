import {
  batchPhaseMinutes,
  clamp,
  continuousPhaseMinutes,
} from "./durations.js";
import type {
  EtaConfidence,
  EtaWindow,
  LotInput,
  LotSchedule,
  MachineConfig,
  PhaseSchedule,
  StageConfig,
} from "./types.js";

const MS_PER_MINUTE = 60_000;
const PRIORITY_RANK: Record<LotInput["priority"], number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
};

/** Push a start time past any downtime windows on the machine. */
function skipDowntime(startMs: number, downtimes?: Array<[number, number]>): number {
  if (!downtimes || downtimes.length === 0) return startMs;
  let t = startMs;
  // Windows may overlap; iterate until stable.
  let moved = true;
  while (moved) {
    moved = false;
    for (const [from, to] of downtimes) {
      if (t >= from && t < to) {
        t = to;
        moved = true;
      }
    }
  }
  return t;
}

function pickMachine(
  stageId: string,
  machines: MachineConfig[],
): MachineConfig | undefined {
  return machines.find((m) => m.stageId === stageId);
}

/**
 * Whole-line simulation, queue-aware.
 *
 * Lots are processed in queue order (priority first, then given order). Each
 * machine keeps a `freeAt` timeline; a lot's phase cannot start before the
 * machine is free AND the previous phase has produced enough material (respecting
 * overlap). This is the model that makes "two 400 kg vats" differ from "one
 * 800 kg vat": vat capacity + parallelism change when the batch machine frees.
 */
export function simulateLine(
  lots: LotInput[],
  stages: StageConfig[],
  machines: MachineConfig[],
  now: number = Date.now(),
): LotSchedule[] {
  const activeStages = stages
    .filter((s) => s.isEnabled)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Stable priority ordering; equal priority keeps input order.
  const ordered = lots
    .map((lot, idx) => ({ lot, idx }))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.lot.priority] - PRIORITY_RANK[b.lot.priority] ||
        a.idx - b.idx,
    )
    .map((x) => x.lot);

  const machineFreeAt = new Map<string, number>();
  const schedules: LotSchedule[] = [];

  for (const lot of ordered) {
    const phases: PhaseSchedule[] = [];
    let lotAvailableAt = Math.max(lot.availableAtMs, now);
    let confidence: EtaConfidence = "HIGH";

    for (const stage of activeStages) {
      const machine = pickMachine(stage.id, machines);
      if (!machine) {
        // No machine configured for this stage: cannot estimate reliably.
        confidence = "LOW";
        continue;
      }

      let minutes: number;
      let batches: number | undefined;
      try {
        if (stage.stageType === "BATCH") {
          const r = batchPhaseMinutes(lot.weightKg, stage, machine);
          minutes = r.minutes;
          batches = r.batches;
        } else {
          minutes = continuousPhaseMinutes(lot.weightKg, stage, machine);
        }
      } catch {
        // Missing capacity/config → degrade confidence, skip this phase's timing.
        confidence = "LOW";
        continue;
      }

      if (!machine.calibrated && confidence === "HIGH") {
        confidence = "MEDIUM";
      }

      const freeAt = machineFreeAt.get(machine.id) ?? now;
      let startMs = Math.max(lotAvailableAt, freeAt);
      startMs = skipDowntime(startMs, machine.downtimes);
      if (machine.downtimes && machine.downtimes.length > 0 && confidence !== "LOW") {
        confidence = "MEDIUM";
      }
      const endMs = startMs + minutes * MS_PER_MINUTE;

      const phase: PhaseSchedule = {
        lotId: lot.id,
        stageId: stage.id,
        machineId: machine.id,
        startMs,
        endMs,
        estimatedMinutes: minutes,
      };
      if (batches !== undefined) phase.numberOfBatches = batches;
      phases.push(phase);

      // Machine frees at endMs (unless it can overlap the next lot early).
      const overlap = stage.allowsParallelProcessing
        ? Math.min(stage.overlapMinutes, minutes) * MS_PER_MINUTE
        : 0;
      machineFreeAt.set(machine.id, endMs - overlap);

      // Next stage can begin once this stage has produced enough (overlap) or is done.
      lotAvailableAt =
        stage.overlapMinutes > 0
          ? startMs + stage.overlapMinutes * MS_PER_MINUTE
          : endMs;
    }

    const first = phases[0];
    const last = phases[phases.length - 1];
    schedules.push({
      lotId: lot.id,
      estimatedStartMs: first ? first.startMs : lotAvailableAt,
      estimatedCompletionMs: last ? last.endMs : lotAvailableAt,
      phases,
      confidence,
    });
  }

  return schedules;
}

/**
 * Turn a point completion estimate into an interval + confidence. We never show
 * a single artificially precise time: the spread widens as confidence drops.
 */
export function toEtaWindow(
  completionMs: number,
  now: number,
  confidence: EtaConfidence,
): EtaWindow {
  const spread =
    confidence === "HIGH" ? 0.05 : confidence === "MEDIUM" ? 0.12 : 0.25;
  const horizon = Math.max(0, completionMs - now);
  const delta = horizon * spread;
  return {
    lowMs: Math.round(completionMs - delta),
    highMs: Math.round(completionMs + delta),
    confidence,
    spread,
  };
}

/** Overall lot progress (0..100) from completed vs total estimated phase time. */
export function lotProgressPercentage(
  schedule: LotSchedule,
  now: number,
): number {
  const total = schedule.phases.reduce((s, p) => s + p.estimatedMinutes, 0);
  if (total <= 0) return 0;
  let done = 0;
  for (const p of schedule.phases) {
    if (now >= p.endMs) {
      done += p.estimatedMinutes;
    } else if (now > p.startMs) {
      const frac = (now - p.startMs) / (p.endMs - p.startMs);
      done += p.estimatedMinutes * clamp(frac, 0, 1);
    }
  }
  return Math.round((done / total) * 100);
}
