import { requireUser } from "@/lib/auth";
import { resumePhase } from "@/lib/lots";
import { phaseActionSchema } from "@/lib/validation";
import { ok, handleError, fail } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; phaseId: string }> }) {
  try {
    const p = await requireUser(["OPERATOR", "MILL_ADMIN"]);
    if (!p.tenantId) return fail("AUTH", "Tenant mancante", 403);
    const { id, phaseId } = await params;
    const body = phaseActionSchema.parse(await req.json().catch(() => ({})));
    const r = await resumePhase({ tenantId: p.tenantId, lotId: id, phaseId, actor: { actorType: p.role, actorId: p.subjectId }, expectedVersion: body.expectedVersion });
    return ok(r);
  } catch (e) {
    return handleError(e);
  }
}
