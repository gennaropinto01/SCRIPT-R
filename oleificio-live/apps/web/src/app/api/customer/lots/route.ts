import { requireCustomer } from "@/lib/auth";
import { customerLotList } from "@/lib/views";
import { ok, handleError } from "@/lib/http";

export async function GET() {
  try {
    const p = await requireCustomer();
    return ok({ data: await customerLotList(p.tenantId, p.subjectId) });
  } catch (e) {
    return handleError(e);
  }
}
