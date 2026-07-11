import { destroySession } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

export async function POST() {
  try {
    await destroySession();
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
