import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/http";

export async function GET() {
  try {
    const p = await requireUser(["MILL_ADMIN", "OPERATOR"]);
    if (!p.tenantId) return ok({ data: [] });
    const machines = await prisma.machine.findMany({ where: { tenantId: p.tenantId }, orderBy: { code: "asc" } });
    return ok({ data: machines });
  } catch (e) {
    return handleError(e);
  }
}
