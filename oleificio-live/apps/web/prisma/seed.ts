import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_STAGES, DEFAULT_YIELD_PERCENTAGE } from "../src/lib/workflow";
import { recomputeTenantEta } from "../src/lib/eta";

const prisma = new PrismaClient();

async function hash(p: string) {
  return bcrypt.hash(p, 10);
}

// Machines with deliberately different capacities (compact 500 kg/h line and a
// bigger 1200 kg/h line share the plant; two malaxers of different vat sizes).
const MACHINES = [
  { code: "ACC-1", name: "Punto accettazione", type: "acceptance", stageCode: "ACCEPTANCE", nominal: 3000, batch: null, parallel: 1, eff: 1 },
  { code: "DEF-1", name: "Defogliatore", type: "defoliator", stageCode: "DEFOLIATION", nominal: 2000, batch: null, parallel: 1, eff: 0.95 },
  { code: "WSH-1", name: "Lavatrice", type: "washer", stageCode: "WASHING", nominal: 1800, batch: null, parallel: 1, eff: 0.95 },
  { code: "CRU-1", name: "Frangitore a martelli", type: "crusher", stageCode: "CRUSHING", nominal: 1000, batch: null, parallel: 1, eff: 0.9, calibrated: true },
  { code: "MAL-1", name: "Gramola 2×400 kg", type: "malaxer", stageCode: "MALAXING", nominal: null, batch: 400, parallel: 2, eff: 1, calibrated: true },
  { code: "DEC-1", name: "Decanter centrifugo", type: "decanter", stageCode: "DECANTER", nominal: 1000, batch: null, parallel: 1, eff: 0.92, calibrated: true },
  { code: "SEP-1", name: "Separatore verticale", type: "separator", stageCode: "SEPARATION", nominal: 1200, batch: null, parallel: 1, eff: 0.95 },
  { code: "FIL-1", name: "Filtro a cartoni", type: "filter", stageCode: "FILTRATION", nominal: 800, batch: null, parallel: 1, eff: 0.9 },
  { code: "STO-1", name: "Serbatoio inox", type: "tank", stageCode: "STORAGE", nominal: 5000, batch: null, parallel: 1, eff: 1 },
];

const CUSTOMERS = [
  { fullName: "Giuseppe Verdi", username: "gverdi", email: "gverdi@example.com" },
  { fullName: "Maria Bianchi", username: "mbianchi", email: null },
  { fullName: "Antonio Russo", username: "arusso", email: "arusso@example.com" },
  { fullName: "Lucia Esposito", username: "lesposito", email: null },
  { fullName: "Francesco Romano", username: "fromano", email: "fromano@example.com" },
];

async function main() {
  console.log("Seeding…");
  // Clean (dev only)
  await prisma.$transaction([
    prisma.auditLog.deleteMany(), prisma.notification.deleteMany(), prisma.telemetryReading.deleteMany(),
    prisma.document.deleteMany(), prisma.lotPhase.deleteMany(), prisma.oliveLot.deleteMany(),
    prisma.delivery.deleteMany(), prisma.machineDowntime.deleteMany(), prisma.machine.deleteMany(),
    prisma.processingStage.deleteMany(), prisma.customer.deleteMany(), prisma.user.deleteMany(),
    prisma.session.deleteMany(), prisma.tenant.deleteMany(),
  ]);

  const tenant = await prisma.tenant.create({ data: { name: "Oleificio San Martino", slug: "san-martino", logoText: "Oleificio San Martino" } });

  // Global super admin (no tenant)
  await prisma.user.create({ data: { email: "super@oleificio.local", passwordHash: await hash("super123"), fullName: "Super Admin", role: "SUPER_ADMIN", tenantId: null } });
  // Mill admin + operators
  await prisma.user.create({ data: { tenantId: tenant.id, email: "admin@sanmartino.local", passwordHash: await hash("admin123"), fullName: "Anna Conti", role: "MILL_ADMIN" } });
  await prisma.user.create({ data: { tenantId: tenant.id, email: "op1@sanmartino.local", passwordHash: await hash("op123"), fullName: "Marco Ferri", role: "OPERATOR" } });
  await prisma.user.create({ data: { tenantId: tenant.id, email: "op2@sanmartino.local", passwordHash: await hash("op123"), fullName: "Elena Gallo", role: "OPERATOR" } });

  // Stages
  for (let i = 0; i < DEFAULT_STAGES.length; i++) {
    const s = DEFAULT_STAGES[i]!;
    await prisma.processingStage.create({
      data: {
        tenantId: tenant.id, code: s.code, name: s.name, customerDescription: s.customerDescription,
        orderIndex: i, stageType: s.stageType, isOptional: s.isOptional, isEnabled: s.code !== "FILTRATION",
        setupMinutes: s.setupMinutes, cleanupMinutes: s.cleanupMinutes, overlapMinutes: s.overlapMinutes,
        averageMinutes: s.averageMinutes ?? null, averageBatchDurationMinutes: s.averageBatchDurationMinutes ?? null,
        allowsParallelProcessing: s.allowsParallelProcessing, animationKey: s.animationKey,
      },
    });
  }

  // Machines
  const machineByStage: Record<string, string> = {};
  for (const m of MACHINES) {
    const created = await prisma.machine.create({
      data: {
        tenantId: tenant.id, code: m.code, name: m.name, type: m.type, stageCode: m.stageCode,
        nominalCapacityKgPerHour: m.nominal, batchCapacityKg: m.batch, parallelBatchCount: m.parallel,
        efficiencyFactor: m.eff, calibrated: (m as any).calibrated ?? false, telemetryEnabled: m.stageCode === "MALAXING",
        currentTemperature: m.stageCode === "MALAXING" ? 27 : null,
      },
    });
    machineByStage[m.stageCode] = created.id;
  }

  // Customers
  const customers: Awaited<ReturnType<typeof prisma.customer.create>>[] = [];
  for (const c of CUSTOMERS) {
    const created = await prisma.customer.create({
      data: { tenantId: tenant.id, fullName: c.fullName, email: c.email, username: c.username, passwordHash: await hash("cliente123"), mustChangePassword: false },
    });
    customers.push(created);
  }

  const stages = await prisma.processingStage.findMany({ where: { tenantId: tenant.id, isEnabled: true }, orderBy: { orderIndex: "asc" } });
  const year = new Date().getFullYear();
  const HOUR = 3600_000;

  // Helper to create a lot advanced up to `completedUpTo` stage index, with the
  // next one RUNNING if `running` is true.
  async function makeLot(idx: number, opts: { customerIdx: number; weight: number; variety: string; completedUpTo: number; running: boolean; status: string; priority?: string; startedHoursAgo?: number; organic?: boolean; delayed?: boolean }) {
    const seq = String(idx).padStart(5, "0");
    const cust = customers[opts.customerIdx]!;
    const delivery = await prisma.delivery.create({ data: { tenantId: tenant.id, customerId: cust.id, netWeightKg: opts.weight } });
    const startedAt = opts.startedHoursAgo ? new Date(Date.now() - opts.startedHoursAgo * HOUR) : null;
    const lot = await prisma.oliveLot.create({
      data: {
        tenantId: tenant.id, customerId: cust.id, deliveryId: delivery.id,
        publicTrackingCode: `OL-${year}-${seq}`, internalLotCode: `INT-${year}-${seq}`,
        status: opts.status, priority: opts.priority ?? "NORMAL", oliveWeightKg: opts.weight, oliveVariety: opts.variety,
        organicFlag: opts.organic ?? false,
        estimatedOilLiters: Math.round(opts.weight * (DEFAULT_YIELD_PERCENTAGE / 100) * 10) / 10,
        actualStartAt: startedAt, queuePosition: idx,
        notes: opts.delayed ? "Ritardo per fermo macchina" : null,
      },
    });
    for (let i = 0; i < stages.length; i++) {
      const st = stages[i]!;
      let status = "PENDING";
      if (i < opts.completedUpTo) status = "COMPLETED";
      else if (i === opts.completedUpTo && opts.running) status = "RUNNING";
      else if (i === opts.completedUpTo) status = "READY";
      await prisma.lotPhase.create({
        data: {
          tenantId: tenant.id, lotId: lot.id, stageId: st.id, stageCode: st.code, orderIndex: i, status,
          machineId: status === "RUNNING" ? machineByStage[st.code] ?? null : null,
          actualStartAt: i <= opts.completedUpTo && startedAt ? new Date(startedAt.getTime() + i * 20 * 60000) : null,
          actualEndAt: i < opts.completedUpTo && startedAt ? new Date(startedAt.getTime() + (i + 1) * 20 * 60000) : null,
        },
      });
    }
    if (opts.running) {
      const runningStage = stages[opts.completedUpTo]!;
      await prisma.oliveLot.update({ where: { id: lot.id }, data: { currentStageCode: runningStage.code, currentMachineId: machineByStage[runningStage.code] ?? null } });
      const mid = machineByStage[runningStage.code];
      if (mid) await prisma.machine.update({ where: { id: mid }, data: { status: "ACTIVE", currentLotId: lot.id } });
    }
    return lot;
  }

  // 3 in-progress lots at different stages
  await makeLot(1, { customerIdx: 0, weight: 800, variety: "Coratina", completedUpTo: 4, running: true, status: "IN_PROGRESS", startedHoursAgo: 2 }); // in MALAXING
  await makeLot(2, { customerIdx: 1, weight: 500, variety: "Peranzana", completedUpTo: 3, running: true, status: "IN_PROGRESS", startedHoursAgo: 1 }); // in CRUSHING
  await makeLot(3, { customerIdx: 2, weight: 1200, variety: "Ogliarola", completedUpTo: 5, running: true, status: "IN_PROGRESS", priority: "HIGH", startedHoursAgo: 3 }); // in DECANTER

  // 1 delayed lot (blocked-ish, urgent)
  await makeLot(4, { customerIdx: 3, weight: 600, variety: "Leccino", completedUpTo: 2, running: false, status: "QUEUED", priority: "URGENT", delayed: true });

  // 1 completed lot
  const completed = await makeLot(5, { customerIdx: 4, weight: 700, variety: "Frantoio", completedUpTo: stages.length, running: false, status: "COMPLETED", startedHoursAgo: 6, organic: true });
  await prisma.oliveLot.update({ where: { id: completed.id }, data: { actualOilLiters: 108, yieldPercentage: Math.round((108 / 700) * 1000) / 10, actualCompletionAt: new Date(Date.now() - HOUR), progressPercentage: 100 } });
  await prisma.document.create({ data: { tenantId: tenant.id, lotId: completed.id, kind: "RESULT", fileName: "risultato-molitura.pdf", visibleToCustomer: true } });
  await prisma.notification.create({ data: { tenantId: tenant.id, customerId: completed.customerId, lotId: completed.id, eventType: "LOT_COMPLETED", dedupeKey: `${completed.id}:LOT_COMPLETED:IN_APP`, title: "Lavorazione completata", body: `Il lotto ${completed.publicTrackingCode} è completato. Resa 15.4%.` } });

  // 5 queued lots
  for (let i = 6; i <= 10; i++) {
    await makeLot(i, { customerIdx: (i - 1) % 5, weight: 400 + i * 50, variety: "Coratina", completedUpTo: 0, running: false, status: "QUEUED" });
  }

  // Machine downtime (open) on the filter and simulated telemetry on the malaxer
  const malaxerId = machineByStage["MALAXING"]!;
  await prisma.machineDowntime.create({ data: { tenantId: tenant.id, machineId: machineByStage["FILTRATION"]!, reason: "Manutenzione programmata", planned: true, startedAt: new Date(Date.now() - 2 * HOUR) } });
  await prisma.machine.update({ where: { id: machineByStage["FILTRATION"]! }, data: { status: "MAINTENANCE" } });
  for (let i = 0; i < 5; i++) {
    await prisma.telemetryReading.create({ data: { tenantId: tenant.id, machineId: malaxerId, metric: "temperature_c", numericValue: 26 + i * 0.4, unit: "°C", quality: "GOOD", sourceTimestamp: new Date(Date.now() - (5 - i) * 60000) } });
  }

  await recomputeTenantEta(prisma, tenant.id);

  console.log("Seed completo.");
  console.log("Login staff:  admin@sanmartino.local / admin123  ·  op1@sanmartino.local / op123");
  console.log("Login cliente: gverdi / cliente123  (username, non email)");
  console.log("Super admin:  super@oleificio.local / super123");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
