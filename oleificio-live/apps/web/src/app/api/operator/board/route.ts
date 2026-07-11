import { requireUser } from "@/lib/auth";
import { operatorBoard } from "@/lib/views";
import { ok, handleError } from "@/lib/http";

export async function GET() {
  try {
    const p = await requireUser(["OPERATOR", "MILL_ADMIN"]);
    if (!p.tenantId) return ok({ data: [] });
    return ok({ data: await operatorBoard(p.tenantId) });
  } catch (e) {
    return handleError(e);
  }
}
