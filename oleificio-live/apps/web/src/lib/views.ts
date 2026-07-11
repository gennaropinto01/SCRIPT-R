import { prisma } from "./db";
import { STATUS_LABELS_IT } from "./types";

// All queries here are scoped by tenantId AND customerId so a customer can never
// see another customer's data. Filtering happens in the query, not the UI.

export async function customerLotList(tenantId: string, customerId: string) {
  const lots = await prisma.oliveLot.findMany({
    where: { tenantId, customerId },
    orderBy: { createdAt: "desc" },
  });
  return lots.map((l) => ({
    id: l.id,
    trackingCode: l.publicTrackingCode,
    status: l.status,
    statusLabel: STATUS_LABELS_IT[l.status] ?? l.status,
    weightKg: l.oliveWeightKg,
    variety: l.oliveVariety,
    progress: Math.round(l.progressPercentage),
    currentStageCode: l.currentStageCode,
  }));
}

export async function customerLotDetail(tenantId: string, customerId: string, lotId: string) {
  const lot = await prisma.oliveLot.findFirst({ where: { id: lotId, tenantId, customerId } });
  if (!lot) return null;
  const phases = await prisma.lotPhase.findMany({ where: { lotId: lot.id }, orderBy: { orderIndex: "asc" } });
  const stages = await prisma.processingStage.findMany({ where: { tenantId } });
  const stageByCode = new Map(stages.map((s) => [s.code, s]));
  const currentStage = lot.currentStageCode ? stageByCode.get(lot.currentStageCode) : null;

  return {
    id: lot.id,
    trackingCode: lot.publicTrackingCode,
    status: lot.status,
    statusLabel: STATUS_LABELS_IT[lot.status] ?? lot.status,
    priority: lot.priority,
    weightKg: lot.oliveWeightKg,
    variety: lot.oliveVariety,
    organic: lot.organicFlag,
    progress: Math.round(lot.progressPercentage),
    currentStage: currentStage
      ? { code: currentStage.code, name: currentStage.name, description: currentStage.customerDescription, animationKey: currentStage.animationKey }
      : null,
    eta: {
      lowAt: lot.etaLowAt, highAt: lot.etaHighAt, confidence: lot.etaConfidence, updatedAt: lot.etaUpdatedAt,
      estimatedCompletionAt: lot.estimatedCompletionAt,
    },
    result: lot.status === "COMPLETED" || lot.status === "READY_FOR_PICKUP" || lot.status === "DELIVERED"
      ? { oilLiters: lot.actualOilLiters, yieldPercentage: lot.yieldPercentage, completedAt: lot.actualCompletionAt, estimatedOilLiters: lot.estimatedOilLiters }
      : { estimatedOilLiters: lot.estimatedOilLiters },
    timeline: phases.map((p) => ({
      stageCode: p.stageCode,
      name: stageByCode.get(p.stageCode)?.name ?? p.stageCode,
      status: p.status,
      estimatedStartAt: p.estimatedStartAt,
      estimatedEndAt: p.estimatedEndAt,
      actualStartAt: p.actualStartAt,
      actualEndAt: p.actualEndAt,
      numberOfBatches: p.numberOfBatches,
    })),
  };
}

export async function customerNotifications(tenantId: string, customerId: string) {
  return prisma.notification.findMany({ where: { tenantId, customerId }, orderBy: { createdAt: "desc" }, take: 30 });
}

// Operator/admin view: all lots for the tenant with queue + machine info.
export async function operatorBoard(tenantId: string) {
  const lots = await prisma.oliveLot.findMany({
    where: { tenantId, status: { notIn: ["DELIVERED", "CANCELLED"] } },
    orderBy: [{ queuePosition: "asc" }],
    include: { customer: { select: { fullName: true } }, phases: { orderBy: { orderIndex: "asc" } } },
  });
  return lots.map((l) => ({
    id: l.id,
    trackingCode: l.publicTrackingCode,
    customerName: l.customer.fullName,
    status: l.status,
    statusLabel: STATUS_LABELS_IT[l.status] ?? l.status,
    priority: l.priority,
    weightKg: l.oliveWeightKg,
    progress: Math.round(l.progressPercentage),
    currentStageCode: l.currentStageCode,
    queuePosition: l.queuePosition,
    version: l.version,
    etaConfidence: l.etaConfidence,
    estimatedCompletionAt: l.estimatedCompletionAt,
    phases: l.phases.map((p) => ({ id: p.id, stageCode: p.stageCode, status: p.status, orderIndex: p.orderIndex, version: p.version })),
  }));
}
