import { requireUser } from "@/lib/auth";
import { reorderQueue } from "@/lib/queue";
import { reorderSchema } from "@/lib/validation";
import { operatorBoard } from "@/lib/views";
import { ok, handleError, fail } from "@/lib/http";

export async function GET() {
  try {
    const p = await requireUser(["MILL_ADMIN", "OPERATOR"]);
    if (!p.tenantId) return ok({ data: [] });
    const board = await operatorBoard(p.tenantId);
    return ok({ data: board.filter((l) => ["QUEUED", "SCHEDULED", "IN_PROGRESS", "PAUSED"].includes(l.status)) });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const p = await requireUser(["MILL_ADMIN"]);
    if (!p.tenantId) return fail("AUTH", "Tenant mancante", 403);
    const body = reorderSchema.parse(await req.json());
    const r = await reorderQueue({ tenantId: p.tenantId, orderedLotIds: body.orderedLotIds, reason: body.reason, actor: { actorType: p.role, actorId: p.subjectId } });
    return ok(r);
  } catch (e) {
    return handleError(e);
  }
}
