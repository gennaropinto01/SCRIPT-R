import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Append-only audit log. Every significant change goes through here.
export async function appendAudit(
  db: Db,
  entry: {
    tenantId: string;
    eventType: string;
    actorType: string;
    actorId?: string | null;
    source: string;
    lotId?: string | null;
    machineId?: string | null;
    payload?: unknown;
    correlationId?: string | null;
    previousState?: string | null;
    newState?: string | null;
  },
): Promise<string> {
  const eventId = randomUUID();
  await db.auditLog.create({
    data: {
      eventId,
      tenantId: entry.tenantId,
      eventType: entry.eventType,
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      source: entry.source,
      lotId: entry.lotId ?? null,
      machineId: entry.machineId ?? null,
      payload: JSON.stringify(entry.payload ?? {}),
      correlationId: entry.correlationId ?? eventId,
      previousState: entry.previousState ?? null,
      newState: entry.newState ?? null,
    },
  });
  return eventId;
}
