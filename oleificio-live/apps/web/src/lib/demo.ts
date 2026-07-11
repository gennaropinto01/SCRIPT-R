import { prisma } from "./db";
import { createLotFromDelivery, startPhase, completePhase } from "./lots";
import { setMachineStatus } from "./queue";

const DEMO_ACTOR = { actorType: "SYSTEM", actorId: "demo" };

// Create a fresh demo lot for the tenant's first customer.
export async function startDemoLot(tenantId: string) {
  const customer = await prisma.customer.findFirst({ where: { tenantId } });
  if (!customer) throw new Error("Nessun cliente per la demo");
  const lot = await createLotFromDelivery({
    tenantId, customerId: customer.id, weightKg: 800, variety: "Coratina (demo)", organic: false, actor: DEMO_ACTOR,
  });
  return lot;
}

// Advance one phase for the given lot: start a READY phase, or complete a RUNNING one.
export async function stepDemoLot(tenantId: string, lotId: string) {
  const running = await prisma.lotPhase.findFirst({ where: { tenantId, lotId, status: "RUNNING" }, orderBy: { orderIndex: "asc" } });
  if (running) {
    await completePhase({ tenantId, lotId, phaseId: running.id, actor: DEMO_ACTOR });
    return { action: "completed", stageCode: running.stageCode };
  }
  const ready = await prisma.lotPhase.findFirst({ where: { tenantId, lotId, status: "READY" }, orderBy: { orderIndex: "asc" } });
  if (ready) {
    await startPhase({ tenantId, lotId, phaseId: ready.id, actor: DEMO_ACTOR });
    return { action: "started", stageCode: ready.stageCode };
  }
  return { action: "idle" };
}

export async function simulateMachineStop(tenantId: string, machineCodeOrId: string) {
  const machine = await prisma.machine.findFirst({ where: { tenantId, OR: [{ id: machineCodeOrId }, { code: machineCodeOrId }] } });
  if (!machine) throw new Error("Macchina non trovata");
  await setMachineStatus({ tenantId, machineId: machine.id, status: "MAINTENANCE", reason: "Fermo simulato (demo)", actor: DEMO_ACTOR });
  return { machineId: machine.id };
}

export async function restoreMachine(tenantId: string, machineCodeOrId: string) {
  const machine = await prisma.machine.findFirst({ where: { tenantId, OR: [{ id: machineCodeOrId }, { code: machineCodeOrId }] } });
  if (!machine) throw new Error("Macchina non trovata");
  await setMachineStatus({ tenantId, machineId: machine.id, status: "IDLE", actor: DEMO_ACTOR });
  return { machineId: machine.id };
}
