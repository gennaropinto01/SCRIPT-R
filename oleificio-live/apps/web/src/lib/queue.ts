import { prisma } from "./db";
import { appendAudit } from "./audit";
import { notify } from "./notifications";
import { recomputeTenantEta } from "./eta";

interface Actor { actorType: string; actorId: string | null }

// Reorder the production queue. Reason is mandatory; ETA is recomputed and the
// affected customers are notified.
export async function reorderQueue(params: {
  tenantId: string;
  orderedLotIds: string[];
  reason: string;
  actor: Actor;
}) {
  const { tenantId, orderedLotIds, reason } = params;
  if (!reason?.trim()) throw new Error("Motivazione obbligatoria per la modifica della coda");
  return prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedLotIds.length; i++) {
      await tx.oliveLot.updateMany({ where: { id: orderedLotIds[i], tenantId }, data: { queuePosition: i + 1 } });
    }
    await appendAudit(tx, {
      tenantId, eventType: "QUEUE_REORDERED", actorType: params.actor.actorType, actorId: params.actor.actorId,
      source: "admin", payload: { order: orderedLotIds, reason },
    });
    await recomputeTenantEta(tx, tenantId, { actorType: params.actor.actorType, actorId: params.actor.actorId });
    return { ok: true };
  });
}

export async function setLotPriority(params: { tenantId: string; lotId: string; priority: string; reason: string; actor: Actor }) {
  const { tenantId, lotId, priority, reason } = params;
  if (!reason?.trim()) throw new Error("Motivazione obbligatoria");
  return prisma.$transaction(async (tx) => {
    const lot = await tx.oliveLot.findFirst({ where: { id: lotId, tenantId } });
    if (!lot) throw new Error("Lotto non trovato");
    await tx.oliveLot.update({ where: { id: lot.id }, data: { priority, version: lot.version + 1 } });
    await appendAudit(tx, { tenantId, lotId, eventType: "LOT_PRIORITY_CHANGED", actorType: params.actor.actorType, actorId: params.actor.actorId, source: "admin", payload: { priority, reason } });
    await recomputeTenantEta(tx, tenantId, { actorType: params.actor.actorType, actorId: params.actor.actorId });
    return { ok: true };
  });
}

// Machine stop / restart → recompute ETA (machine downtime affects the whole line).
export async function setMachineStatus(params: { tenantId: string; machineId: string; status: string; reason?: string; actor: Actor }) {
  const { tenantId, machineId, status } = params;
  return prisma.$transaction(async (tx) => {
    const machine = await tx.machine.findFirst({ where: { id: machineId, tenantId } });
    if (!machine) throw new Error("Macchina non trovata");
    const stopping = status === "MAINTENANCE" || status === "ERROR";
    await tx.machine.update({ where: { id: machine.id }, data: { status, version: machine.version + 1 } });
    if (stopping) {
      await tx.machineDowntime.create({ data: { tenantId, machineId, reason: params.reason ?? status, planned: status === "MAINTENANCE", startedAt: new Date() } });
      await appendAudit(tx, { tenantId, machineId, eventType: "MACHINE_STOPPED", actorType: params.actor.actorType, actorId: params.actor.actorId, source: "admin", newState: status });
    } else {
      await tx.machineDowntime.updateMany({ where: { machineId, endedAt: null }, data: { endedAt: new Date() } });
      await appendAudit(tx, { tenantId, machineId, eventType: "MACHINE_RESTARTED", actorType: params.actor.actorType, actorId: params.actor.actorId, source: "admin", newState: status });
    }
    await recomputeTenantEta(tx, tenantId, { actorType: params.actor.actorType, actorId: params.actor.actorId });
    return { ok: true };
  });
}
