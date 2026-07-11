import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Idempotent notification creation: the same (eventKey, channel) is never sent twice.
export async function notify(
  db: Db,
  params: {
    tenantId: string;
    customerId?: string | null;
    lotId?: string | null;
    eventType: string;
    dedupeKey: string; // e.g. `${lotId}:${eventType}:${stageCode}`
    title: string;
    body: string;
    channel?: string;
  },
): Promise<void> {
  const channel = params.channel ?? "IN_APP";
  const existing = await db.notification.findUnique({ where: { dedupeKey: `${params.dedupeKey}:${channel}` } });
  if (existing) return;
  await db.notification.create({
    data: {
      tenantId: params.tenantId,
      customerId: params.customerId ?? null,
      lotId: params.lotId ?? null,
      channel,
      eventType: params.eventType,
      dedupeKey: `${params.dedupeKey}:${channel}`,
      title: params.title,
      body: params.body,
    },
  });
}
