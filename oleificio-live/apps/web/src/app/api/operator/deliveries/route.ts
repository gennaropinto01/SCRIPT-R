import { requireUser } from "@/lib/auth";
import { createLotFromDelivery } from "@/lib/lots";
import { deliverySchema } from "@/lib/validation";
import { ok, handleError, fail } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const p = await requireUser(["OPERATOR", "MILL_ADMIN"]);
    if (!p.tenantId) return fail("AUTH", "Tenant mancante", 403);
    const body = deliverySchema.parse(await req.json());
    const lot = await createLotFromDelivery({
      tenantId: p.tenantId, customerId: body.customerId, weightKg: body.weightKg,
      variety: body.variety, organic: body.organic, actor: { actorType: p.role, actorId: p.subjectId },
    });
    return ok({ id: lot.id, trackingCode: lot.publicTrackingCode }, 201);
  } catch (e) {
    return handleError(e);
  }
}
