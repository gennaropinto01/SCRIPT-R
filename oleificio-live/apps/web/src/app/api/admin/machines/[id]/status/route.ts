import { requireUser } from "@/lib/auth";
import { setMachineStatus } from "@/lib/queue";
import { machineStatusSchema } from "@/lib/validation";
import { ok, handleError, fail } from "@/lib/http";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await requireUser(["MILL_ADMIN"]);
    if (!p.tenantId) return fail("AUTH", "Tenant mancante", 403);
    const { id } = await params;
    const body = machineStatusSchema.parse(await req.json());
    const r = await setMachineStatus({ tenantId: p.tenantId, machineId: id, status: body.status, reason: body.reason, actor: { actorType: p.role, actorId: p.subjectId } });
    return ok(r);
  } catch (e) {
    return handleError(e);
  }
}
