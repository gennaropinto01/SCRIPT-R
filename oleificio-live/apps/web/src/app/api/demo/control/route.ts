import { requireUser } from "@/lib/auth";
import { startDemoLot, stepDemoLot, simulateMachineStop, restoreMachine } from "@/lib/demo";
import { demoControlSchema } from "@/lib/validation";
import { ok, handleError, fail } from "@/lib/http";

// Demo mode is staff-only. Advances a simulated lot through the line so the 3D
// scene, timeline, ETA and notifications all update together.
export async function POST(req: Request) {
  try {
    const p = await requireUser(["MILL_ADMIN", "OPERATOR"]);
    if (!p.tenantId) return fail("AUTH", "Tenant mancante", 403);
    const body = demoControlSchema.parse(await req.json());
    const tenantId = p.tenantId;

    switch (body.action) {
      case "start": {
        const lot = await startDemoLot(tenantId);
        return ok({ lotId: lot.id, trackingCode: lot.publicTrackingCode });
      }
      case "step": {
        if (!body.lotId) return fail("VALIDATION", "lotId richiesto", 400);
        return ok(await stepDemoLot(tenantId, body.lotId));
      }
      case "stop_machine":
        return ok(await simulateMachineStop(tenantId, body.machine ?? "MAL-1"));
      case "restore_machine":
        return ok(await restoreMachine(tenantId, body.machine ?? "MAL-1"));
      default:
        return fail("VALIDATION", "Azione non supportata", 400);
    }
  } catch (e) {
    return handleError(e);
  }
}
