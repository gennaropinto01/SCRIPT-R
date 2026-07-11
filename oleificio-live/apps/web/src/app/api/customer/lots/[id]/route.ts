import { requireCustomer } from "@/lib/auth";
import { customerLotDetail } from "@/lib/views";
import { ok, fail, handleError } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await requireCustomer();
    const { id } = await params;
    const lot = await customerLotDetail(p.tenantId, p.subjectId, id);
    if (!lot) return fail("NOT_FOUND", "Lotto non trovato", 404);
    return ok(lot);
  } catch (e) {
    return handleError(e);
  }
}
