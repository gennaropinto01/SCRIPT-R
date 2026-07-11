import { requireUser } from "@/lib/auth";
import { recordOilOutput } from "@/lib/lots";
import { oilOutputSchema } from "@/lib/validation";
import { ok, handleError, fail } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await requireUser(["OPERATOR", "MILL_ADMIN"]);
    if (!p.tenantId) return fail("AUTH", "Tenant mancante", 403);
    const { id } = await params;
    const body = oilOutputSchema.parse(await req.json());
    const r = await recordOilOutput({ tenantId: p.tenantId, lotId: id, liters: body.liters, actor: { actorType: p.role, actorId: p.subjectId } });
    return ok(r);
  } catch (e) {
    return handleError(e);
  }
}
