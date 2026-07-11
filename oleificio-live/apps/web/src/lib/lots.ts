import { prisma } from "./db";
import { appendAudit } from "./audit";
import { notify } from "./notifications";
import { recomputeTenantEta } from "./eta";
import { assertLotTransition, assertPhaseTransition, StateError } from "./stateMachine";
import { DEFAULT_STAGES, DEFAULT_YIELD_PERCENTAGE } from "./workflow";
import type { LotStatus, PhaseStatus } from "./types";

export class ConflictError extends Error {
  readonly code = "CONFLICT";
}
export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";
}

interface Actor {
  actorType: string;
  actorId: string | null;
}

// ---- Create a lot from a delivery (operator) ----
export async function createLotFromDelivery(params: {
  tenantId: string;
  customerId: string;
  weightKg: number;
  variety?: string;
  organic?: boolean;
  actor: Actor;
}) {
  const { tenantId, customerId, weightKg } = params;
  return prisma.$transaction(async (tx) => {
    const count = await tx.oliveLot.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    const seq = String(count + 1).padStart(5, "0");
    const stages = await tx.processingStage.findMany({
      where: { tenantId, isEnabled: true },
      orderBy: { orderIndex: "asc" },
    });
    const maxPos = await tx.oliveLot.aggregate({ where: { tenantId }, _max: { queuePosition: true } });

    const delivery = await tx.delivery.create({
      data: { tenantId, customerId, netWeightKg: weightKg },
    });

    const lot = await tx.oliveLot.create({
      data: {
        tenantId,
        customerId,
        deliveryId: delivery.id,
        publicTrackingCode: `OL-${year}-${seq}`,
        internalLotCode: `INT-${year}-${seq}`,
        status: "QUEUED",
        oliveWeightKg: weightKg,
        oliveVariety: params.variety ?? null,
        organicFlag: params.organic ?? false,
        estimatedOilLiters: Math.round(weightKg * (DEFAULT_YIELD_PERCENTAGE / 100) * 10) / 10,
        queuePosition: (maxPos._max.queuePosition ?? 0) + 1,
        phases: {
          create: stages.map((s, i) => ({
            tenantId,
            stageId: s.id,
            stageCode: s.code,
            orderIndex: i,
            status: i === 0 ? "READY" : "PENDING",
          })),
        },
      },
    });

    await appendAudit(tx, {
      tenantId, lotId: lot.id, eventType: "LOT_CREATED", actorType: params.actor.actorType,
      actorId: params.actor.actorId, source: "operator", newState: "QUEUED",
      payload: { weightKg, trackingCode: lot.publicTrackingCode },
    });
    await notify(tx, {
      tenantId, customerId, lotId: lot.id, eventType: "LOT_QUEUED",
      dedupeKey: `${lot.id}:LOT_QUEUED`, title: "Lotto in coda",
      body: `Il lotto ${lot.publicTrackingCode} è stato registrato ed è in coda di lavorazione.`,
    });

    await recomputeTenantEta(tx, tenantId, { actorType: params.actor.actorType, actorId: params.actor.actorId });
    return lot;
  });
}

async function loadLotPhase(tx: any, tenantId: string, lotId: string, phaseId: string, expectedVersion?: number) {
  const lot = await tx.oliveLot.findFirst({ where: { id: lotId, tenantId } });
  if (!lot) throw new NotFoundError("Lotto non trovato");
  const phase = await tx.lotPhase.findFirst({ where: { id: phaseId, lotId, tenantId } });
  if (!phase) throw new NotFoundError("Fase non trovata");
  if (expectedVersion !== undefined && phase.version !== expectedVersion) {
    throw new ConflictError(`Versione fase non aggiornata (attesa ${expectedVersion}, attuale ${phase.version})`);
  }
  return { lot, phase };
}

// ---- Start a phase (operator) ----
export async function startPhase(params: {
  tenantId: string; lotId: string; phaseId: string; actor: Actor; expectedVersion?: number;
}) {
  const { tenantId, lotId, phaseId } = params;
  return prisma.$transaction(async (tx) => {
    const { lot, phase } = await loadLotPhase(tx, tenantId, lotId, phaseId, params.expectedVersion);
    assertPhaseTransition(phase.status as PhaseStatus, "RUNNING");

    if (lot.status !== "IN_PROGRESS") {
      assertLotTransition(lot.status as LotStatus, "IN_PROGRESS");
    }
    const now = new Date();
    const machine = await tx.machine.findFirst({ where: { tenantId, stageCode: phase.stageCode } });

    await tx.lotPhase.update({
      where: { id: phase.id },
      data: { status: "RUNNING", actualStartAt: phase.actualStartAt ?? now, machineId: machine?.id ?? null, version: phase.version + 1 },
    });
    await tx.oliveLot.update({
      where: { id: lot.id },
      data: {
        status: "IN_PROGRESS",
        actualStartAt: lot.actualStartAt ?? now,
        currentStageCode: phase.stageCode,
        currentMachineId: machine?.id ?? null,
        version: lot.version + 1,
      },
    });
    if (machine) {
      await tx.machine.update({ where: { id: machine.id }, data: { status: "ACTIVE", currentLotId: lot.id, version: machine.version + 1 } });
    }
    await appendAudit(tx, {
      tenantId, lotId: lot.id, machineId: machine?.id ?? null, eventType: "PHASE_STARTED",
      actorType: params.actor.actorType, actorId: params.actor.actorId, source: "operator",
      previousState: phase.status, newState: "RUNNING", payload: { stageCode: phase.stageCode },
    });
    await notify(tx, {
      tenantId, customerId: lot.customerId, lotId: lot.id, eventType: "PHASE_STARTED",
      dedupeKey: `${lot.id}:PHASE_STARTED:${phase.stageCode}`, title: "Nuova fase avviata",
      body: `Il lotto ${lot.publicTrackingCode} è entrato nella fase "${phase.stageCode}".`,
    });
    await recomputeTenantEta(tx, tenantId, { actorType: params.actor.actorType, actorId: params.actor.actorId });
    return { ok: true };
  });
}

// ---- Pause / resume ----
export async function pausePhase(params: { tenantId: string; lotId: string; phaseId: string; actor: Actor; expectedVersion?: number }) {
  return prisma.$transaction(async (tx) => {
    const { lot, phase } = await loadLotPhase(tx, params.tenantId, params.lotId, params.phaseId, params.expectedVersion);
    assertPhaseTransition(phase.status as PhaseStatus, "PAUSED");
    await tx.lotPhase.update({ where: { id: phase.id }, data: { status: "PAUSED", version: phase.version + 1 } });
    await tx.oliveLot.update({ where: { id: lot.id }, data: { status: "PAUSED", version: lot.version + 1 } });
    if (phase.machineId) await tx.machine.update({ where: { id: phase.machineId }, data: { status: "PAUSED" } });
    await appendAudit(tx, { tenantId: params.tenantId, lotId: lot.id, eventType: "PHASE_PAUSED", actorType: params.actor.actorType, actorId: params.actor.actorId, source: "operator", previousState: phase.status, newState: "PAUSED" });
    await recomputeTenantEta(tx, params.tenantId, { actorType: params.actor.actorType, actorId: params.actor.actorId });
    return { ok: true };
  });
}

export async function resumePhase(params: { tenantId: string; lotId: string; phaseId: string; actor: Actor; expectedVersion?: number }) {
  return prisma.$transaction(async (tx) => {
    const { lot, phase } = await loadLotPhase(tx, params.tenantId, params.lotId, params.phaseId, params.expectedVersion);
    assertPhaseTransition(phase.status as PhaseStatus, "RUNNING");
    await tx.lotPhase.update({ where: { id: phase.id }, data: { status: "RUNNING", version: phase.version + 1 } });
    await tx.oliveLot.update({ where: { id: lot.id }, data: { status: "IN_PROGRESS", version: lot.version + 1 } });
    if (phase.machineId) await tx.machine.update({ where: { id: phase.machineId }, data: { status: "ACTIVE" } });
    await appendAudit(tx, { tenantId: params.tenantId, lotId: lot.id, eventType: "PHASE_RESUMED", actorType: params.actor.actorType, actorId: params.actor.actorId, source: "operator", previousState: phase.status, newState: "RUNNING" });
    await recomputeTenantEta(tx, params.tenantId, { actorType: params.actor.actorType, actorId: params.actor.actorId });
    return { ok: true };
  });
}

// ---- Complete a phase; advance to next or finish the lot ----
export async function completePhase(params: { tenantId: string; lotId: string; phaseId: string; actor: Actor; expectedVersion?: number }) {
  const { tenantId } = params;
  return prisma.$transaction(async (tx) => {
    const { lot, phase } = await loadLotPhase(tx, tenantId, params.lotId, params.phaseId, params.expectedVersion);
    assertPhaseTransition(phase.status as PhaseStatus, "COMPLETED");
    const now = new Date();
    await tx.lotPhase.update({ where: { id: phase.id }, data: { status: "COMPLETED", actualEndAt: now, version: phase.version + 1 } });
    if (phase.machineId) {
      await tx.machine.update({ where: { id: phase.machineId }, data: { status: "IDLE", currentLotId: null } });
    }
    await appendAudit(tx, {
      tenantId, lotId: lot.id, machineId: phase.machineId, eventType: "PHASE_COMPLETED",
      actorType: params.actor.actorType, actorId: params.actor.actorId, source: "operator",
      previousState: phase.status, newState: "COMPLETED", payload: { stageCode: phase.stageCode },
    });

    const next = await tx.lotPhase.findFirst({
      where: { lotId: lot.id, orderIndex: { gt: phase.orderIndex }, status: { in: ["PENDING", "WAITING", "READY"] } },
      orderBy: { orderIndex: "asc" },
    });

    if (next) {
      await tx.lotPhase.update({ where: { id: next.id }, data: { status: "READY", version: next.version + 1 } });
      await tx.oliveLot.update({ where: { id: lot.id }, data: { currentStageCode: next.stageCode, version: lot.version + 1 } });
      await notify(tx, {
        tenantId, customerId: lot.customerId, lotId: lot.id, eventType: "PHASE_COMPLETED",
        dedupeKey: `${lot.id}:PHASE_DONE:${phase.stageCode}`, title: "Fase completata",
        body: `Il lotto ${lot.publicTrackingCode} ha completato la fase "${phase.stageCode}".`,
      });
    } else {
      // Last phase → complete the lot.
      assertLotTransition(lot.status as LotStatus, "COMPLETED");
      const oil = lot.actualOilLiters ?? lot.estimatedOilLiters ?? null;
      const yieldPct = oil ? Math.round((oil / lot.oliveWeightKg) * 100 * 10) / 10 : null;
      await tx.oliveLot.update({
        where: { id: lot.id },
        data: {
          status: "COMPLETED", actualCompletionAt: now, progressPercentage: 100,
          currentStageCode: null, currentMachineId: null,
          yieldPercentage: yieldPct, version: lot.version + 1,
        },
      });
      await appendAudit(tx, { tenantId, lotId: lot.id, eventType: "LOT_COMPLETED", actorType: params.actor.actorType, actorId: params.actor.actorId, source: "operator", newState: "COMPLETED" });
      await notify(tx, {
        tenantId, customerId: lot.customerId, lotId: lot.id, eventType: "LOT_COMPLETED",
        dedupeKey: `${lot.id}:LOT_COMPLETED`, title: "Lavorazione completata",
        body: `Il lotto ${lot.publicTrackingCode} è stato completato. Puoi consultare la resa finale.`,
      });
    }

    await recomputeTenantEta(tx, tenantId, { actorType: params.actor.actorType, actorId: params.actor.actorId });
    return { ok: true };
  });
}

// ---- Record oil output / yield ----
export async function recordOilOutput(params: { tenantId: string; lotId: string; liters: number; actor: Actor }) {
  const { tenantId, lotId, liters } = params;
  return prisma.$transaction(async (tx) => {
    const lot = await tx.oliveLot.findFirst({ where: { id: lotId, tenantId } });
    if (!lot) throw new NotFoundError("Lotto non trovato");
    const yieldPct = Math.round((liters / lot.oliveWeightKg) * 100 * 10) / 10;
    await tx.oliveLot.update({ where: { id: lot.id }, data: { actualOilLiters: liters, yieldPercentage: yieldPct, version: lot.version + 1 } });
    await appendAudit(tx, { tenantId, lotId: lot.id, eventType: "OIL_QUANTITY_RECORDED", actorType: params.actor.actorType, actorId: params.actor.actorId, source: "operator", payload: { liters, yieldPct } });
    return { yieldPct };
  });
}

export { StateError };
