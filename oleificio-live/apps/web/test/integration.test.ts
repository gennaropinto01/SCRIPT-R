import { strict as assert } from "node:assert";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { createLotFromDelivery, startPhase, completePhase, ConflictError } from "../src/lib/lots";
import { customerLotDetail } from "../src/lib/views";
import { notify } from "../src/lib/notifications";

// Self-contained integration tests: each run builds its own isolated tenants so
// it can run repeatedly against the dev SQLite DB without touching seed data.
// Covers the brief's mandatory cases: tenant isolation, cross-customer denial,
// optimistic locking (concurrency), notification idempotency, batch gramolazione.

const ACTOR = { actorType: "OPERATOR", actorId: "test" };
let tenantA = "";
let tenantB = "";
let custA1 = "";
let custA2 = "";
let custB1 = "";

async function buildTenant(name: string) {
  const t = await prisma.tenant.create({ data: { name, slug: `t-${randomUUID()}` } });
  // Two stages: a continuous crusher (1000 kg/h) and a batch malaxer (2×400 kg vats).
  await prisma.processingStage.create({ data: { tenantId: t.id, code: "CRUSHING", name: "Frangitura", orderIndex: 0, stageType: "CONTINUOUS", averageMinutes: 0, setupMinutes: 0, cleanupMinutes: 0, animationKey: "crushing" } });
  await prisma.processingStage.create({ data: { tenantId: t.id, code: "MALAXING", name: "Gramolazione", orderIndex: 1, stageType: "BATCH", averageBatchDurationMinutes: 40, setupMinutes: 0, cleanupMinutes: 0, animationKey: "malaxing" } });
  await prisma.machine.create({ data: { tenantId: t.id, code: "CRU", name: "Frangitore", type: "crusher", stageCode: "CRUSHING", nominalCapacityKgPerHour: 1000, efficiencyFactor: 1, calibrated: true } });
  await prisma.machine.create({ data: { tenantId: t.id, code: "MAL", name: "Gramola", type: "malaxer", stageCode: "MALAXING", batchCapacityKg: 400, parallelBatchCount: 1, efficiencyFactor: 1, calibrated: true } });
  return t.id;
}

before(async () => {
  tenantA = await buildTenant("Tenant A");
  tenantB = await buildTenant("Tenant B");
  const a1 = await prisma.customer.create({ data: { tenantId: tenantA, fullName: "Cliente A1", username: `a1-${randomUUID()}`, passwordHash: "x", mustChangePassword: false } });
  const a2 = await prisma.customer.create({ data: { tenantId: tenantA, fullName: "Cliente A2", username: `a2-${randomUUID()}`, passwordHash: "x", mustChangePassword: false } });
  const b1 = await prisma.customer.create({ data: { tenantId: tenantB, fullName: "Cliente B1", username: `b1-${randomUUID()}`, passwordHash: "x", mustChangePassword: false } });
  custA1 = a1.id; custA2 = a2.id; custB1 = b1.id;
});

after(async () => {
  // Clean up both tenants' data.
  for (const t of [tenantA, tenantB]) {
    await prisma.auditLog.deleteMany({ where: { tenantId: t } });
    await prisma.notification.deleteMany({ where: { tenantId: t } });
    await prisma.lotPhase.deleteMany({ where: { tenantId: t } });
    await prisma.oliveLot.deleteMany({ where: { tenantId: t } });
    await prisma.delivery.deleteMany({ where: { tenantId: t } });
    await prisma.machine.deleteMany({ where: { tenantId: t } });
    await prisma.processingStage.deleteMany({ where: { tenantId: t } });
    await prisma.customer.deleteMany({ where: { tenantId: t } });
    await prisma.tenant.delete({ where: { id: t } });
  }
  await prisma.$disconnect();
});

test("lot 500 kg is created QUEUED with the first phase READY", async () => {
  const lot = await createLotFromDelivery({ tenantId: tenantA, customerId: custA1, weightKg: 500, actor: ACTOR });
  assert.equal(lot.status, "QUEUED");
  const phases = await prisma.lotPhase.findMany({ where: { lotId: lot.id }, orderBy: { orderIndex: "asc" } });
  assert.equal(phases.length, 2);
  assert.equal(phases[0]!.status, "READY");
  assert.equal(phases[1]!.status, "PENDING");
});

test("batch gramolazione splits 800 kg into 2 batches", async () => {
  const lot = await createLotFromDelivery({ tenantId: tenantA, customerId: custA1, weightKg: 800, actor: ACTOR });
  const malax = await prisma.lotPhase.findFirst({ where: { lotId: lot.id, stageCode: "MALAXING" } });
  assert.equal(malax!.numberOfBatches, 2); // 800 / 400 = 2 vats
});

test("start → complete advances phases and completes the lot", async () => {
  const lot = await createLotFromDelivery({ tenantId: tenantA, customerId: custA1, weightKg: 400, actor: ACTOR });
  let phases = await prisma.lotPhase.findMany({ where: { lotId: lot.id }, orderBy: { orderIndex: "asc" } });
  // Crushing
  await startPhase({ tenantId: tenantA, lotId: lot.id, phaseId: phases[0]!.id, actor: ACTOR });
  let l = await prisma.oliveLot.findUnique({ where: { id: lot.id } });
  assert.equal(l!.status, "IN_PROGRESS");
  await completePhase({ tenantId: tenantA, lotId: lot.id, phaseId: phases[0]!.id, actor: ACTOR });
  // Malaxing should now be READY
  const malax = await prisma.lotPhase.findFirst({ where: { lotId: lot.id, stageCode: "MALAXING" } });
  assert.equal(malax!.status, "READY");
  await startPhase({ tenantId: tenantA, lotId: lot.id, phaseId: malax!.id, actor: ACTOR });
  await completePhase({ tenantId: tenantA, lotId: lot.id, phaseId: malax!.id, actor: ACTOR });
  l = await prisma.oliveLot.findUnique({ where: { id: lot.id } });
  assert.equal(l!.status, "COMPLETED");
  assert.equal(l!.progressPercentage, 100);
});

test("optimistic locking rejects a stale phase version (concurrency)", async () => {
  const lot = await createLotFromDelivery({ tenantId: tenantA, customerId: custA1, weightKg: 400, actor: ACTOR });
  const phase = await prisma.lotPhase.findFirst({ where: { lotId: lot.id, orderIndex: 0 } });
  // First operator starts it (version 0 → 1)
  await startPhase({ tenantId: tenantA, lotId: lot.id, phaseId: phase!.id, actor: ACTOR, expectedVersion: 0 });
  // Second operator acts on the stale version 0 → conflict
  await assert.rejects(
    () => completePhase({ tenantId: tenantA, lotId: lot.id, phaseId: phase!.id, actor: ACTOR, expectedVersion: 0 }),
    ConflictError,
  );
});

test("tenant isolation: tenant B cannot read tenant A's lot", async () => {
  const lot = await createLotFromDelivery({ tenantId: tenantA, customerId: custA1, weightKg: 500, actor: ACTOR });
  const asTenantB = await customerLotDetail(tenantB, custB1, lot.id);
  assert.equal(asTenantB, null);
});

test("cross-customer denial: customer A2 cannot read customer A1's lot", async () => {
  const lot = await createLotFromDelivery({ tenantId: tenantA, customerId: custA1, weightKg: 500, actor: ACTOR });
  const asA2 = await customerLotDetail(tenantA, custA2, lot.id);
  assert.equal(asA2, null);
  // Owner CAN read it
  const asA1 = await customerLotDetail(tenantA, custA1, lot.id);
  assert.ok(asA1);
  assert.equal(asA1!.id, lot.id);
});

test("notifications are idempotent for the same dedupe key", async () => {
  const key = `dup-${randomUUID()}`;
  await notify(prisma, { tenantId: tenantA, customerId: custA1, eventType: "TEST", dedupeKey: key, title: "t", body: "b" });
  await notify(prisma, { tenantId: tenantA, customerId: custA1, eventType: "TEST", dedupeKey: key, title: "t", body: "b" });
  const rows = await prisma.notification.findMany({ where: { tenantId: tenantA, dedupeKey: `${key}:IN_APP` } });
  assert.equal(rows.length, 1);
});
