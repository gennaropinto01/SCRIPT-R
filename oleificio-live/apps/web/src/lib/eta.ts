import {
  simulateLine,
  toEtaWindow,
  lotProgressPercentage,
  type LotInput,
  type MachineConfig,
  type StageConfig,
  type LotSchedule,
} from "@oleificio/eta-engine";
import type { Prisma, PrismaClient } from "@prisma/client";
import { appendAudit } from "./audit";

type Db = PrismaClient | Prisma.TransactionClient;

const ACTIVE_LOT_STATUSES = ["ACCEPTED", "QUEUED", "SCHEDULED", "IN_PROGRESS", "PAUSED"];

/**
 * Recompute ETAs for a whole tenant line and persist them. This is the single
 * entry point used by every recompute trigger (phase start/complete, machine
 * stop/restore, priority change, queue reorder, telemetry, etc.).
 */
export async function recomputeTenantEta(
  db: Db,
  tenantId: string,
  opts: { actorType?: string; actorId?: string | null; correlationId?: string | null; now?: number } = {},
): Promise<void> {
  const now = opts.now ?? Date.now();

  const stagesDb = await db.processingStage.findMany({
    where: { tenantId, isEnabled: true },
    orderBy: { orderIndex: "asc" },
  });
  const machinesDb = await db.machine.findMany({ where: { tenantId } });
  const openDowntimes = await db.machineDowntime.findMany({
    where: { tenantId, endedAt: null },
  });

  const stages: StageConfig[] = stagesDb.map((s) => ({
    id: s.code,
    code: s.code,
    orderIndex: s.orderIndex,
    stageType: s.stageType === "BATCH" ? "BATCH" : "CONTINUOUS",
    isEnabled: s.isEnabled,
    isOptional: s.isOptional,
    requiresPreviousStage: s.requiresPreviousStage,
    setupMinutes: s.setupMinutes,
    cleanupMinutes: s.cleanupMinutes,
    overlapMinutes: s.overlapMinutes,
    allowsParallelProcessing: s.allowsParallelProcessing,
    averageMinutes: s.averageMinutes ?? undefined,
    averageBatchDurationMinutes: s.averageBatchDurationMinutes ?? undefined,
  }));

  // One machine per stage in this bridge (first eligible). Downtime windows and
  // MAINTENANCE/ERROR status push the machine's availability forward.
  const machines: MachineConfig[] = [];
  for (const stage of stages) {
    const m = machinesDb.find((x) => x.stageCode === stage.code);
    if (!m) continue;
    const downtimes: Array<[number, number]> = openDowntimes
      .filter((d) => d.machineId === m.id)
      .map((d) => [d.startedAt.getTime(), Number.POSITIVE_INFINITY]);
    if (m.status === "MAINTENANCE" || m.status === "ERROR") {
      downtimes.push([now, Number.POSITIVE_INFINITY]);
    }
    machines.push({
      id: m.id,
      stageId: stage.code,
      nominalCapacityKgPerHour: m.nominalCapacityKgPerHour ?? undefined,
      effectiveCapacityKgPerHour: m.effectiveCapacityKgPerHour ?? undefined,
      efficiencyFactor: m.efficiencyFactor,
      batchCapacityKg: m.batchCapacityKg ?? undefined,
      parallelBatchCount: m.parallelBatchCount,
      calibrated: m.calibrated,
      downtimes,
    });
  }

  const lotsDb = await db.oliveLot.findMany({
    where: { tenantId, status: { in: ACTIVE_LOT_STATUSES } },
    orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
  });

  const lots: LotInput[] = lotsDb.map((l) => ({
    id: l.id,
    weightKg: l.oliveWeightKg,
    priority: (l.priority as LotInput["priority"]) ?? "NORMAL",
    availableAtMs: (l.actualStartAt ?? l.arrivalDate).getTime(),
  }));

  const schedules = simulateLine(lots, stages, machines, now);
  const byLot = new Map<string, LotSchedule>(schedules.map((s) => [s.lotId, s]));

  const safeDate = (ms: number): Date | null => (Number.isFinite(ms) ? new Date(ms) : null);

  for (const lot of lotsDb) {
    const sched = byLot.get(lot.id);
    if (!sched) continue;
    const progress = lot.status === "IN_PROGRESS" ? lotProgressPercentage(sched, now) : lot.progressPercentage;

    // An indefinite downtime blocking a required machine makes completion
    // genuinely unknown → persist null ETA with LOW confidence, never a bad date.
    if (!Number.isFinite(sched.estimatedCompletionMs)) {
      await db.oliveLot.update({
        where: { id: lot.id },
        data: {
          estimatedStartAt: safeDate(sched.estimatedStartMs),
          estimatedCompletionAt: null, etaLowAt: null, etaHighAt: null,
          etaConfidence: "LOW", etaUpdatedAt: new Date(now), progressPercentage: progress,
        },
      });
      continue;
    }

    const win = toEtaWindow(sched.estimatedCompletionMs, now, sched.confidence);
    await db.oliveLot.update({
      where: { id: lot.id },
      data: {
        estimatedStartAt: safeDate(sched.estimatedStartMs),
        estimatedCompletionAt: safeDate(sched.estimatedCompletionMs),
        etaLowAt: safeDate(win.lowMs),
        etaHighAt: safeDate(win.highMs),
        etaConfidence: win.confidence,
        etaUpdatedAt: new Date(now),
        progressPercentage: progress,
      },
    });

    // Persist per-phase estimates for the timeline.
    for (const p of sched.phases) {
      await db.lotPhase.updateMany({
        where: { lotId: lot.id, stageCode: p.stageId },
        data: {
          estimatedMinutes: Number.isFinite(p.estimatedMinutes) ? p.estimatedMinutes : null,
          estimatedStartAt: safeDate(p.startMs),
          estimatedEndAt: safeDate(p.endMs),
          numberOfBatches: p.numberOfBatches ?? null,
        },
      });
    }
  }

  await appendAudit(db, {
    tenantId,
    eventType: "ETA_RECALCULATED",
    actorType: opts.actorType ?? "SYSTEM",
    actorId: opts.actorId ?? null,
    source: "eta-engine",
    correlationId: opts.correlationId ?? null,
    payload: { lots: schedules.length, at: new Date(now).toISOString() },
  });
}
