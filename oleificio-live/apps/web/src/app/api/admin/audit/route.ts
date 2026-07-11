import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/http";

export async function GET() {
  try {
    const p = await requireUser(["MILL_ADMIN"]);
    if (!p.tenantId) return ok({ data: [] });
    const logs = await prisma.auditLog.findMany({ where: { tenantId: p.tenantId }, orderBy: { timestamp: "desc" }, take: 100 });
    return ok({ data: logs });
  } catch (e) {
    return handleError(e);
  }
}
