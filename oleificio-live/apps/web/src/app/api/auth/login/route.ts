import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { ok, fail, handleError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = loginSchema.parse(await req.json());
    const id = body.identifier.trim();

    // Staff by email first
    const user = await prisma.user.findFirst({ where: { email: id, isActive: true } });
    if (user && (await verifyPassword(body.password, user.passwordHash))) {
      await createSession({ subjectType: "USER", subjectId: user.id, tenantId: user.tenantId, role: user.role });
      if (user.tenantId) await appendAudit(prisma, { tenantId: user.tenantId, eventType: "USER_LOGIN", actorType: user.role, actorId: user.id, source: "auth" });
      return ok({ role: user.role, name: user.fullName, redirect: user.role === "SUPER_ADMIN" ? "/superadmin" : user.role === "MILL_ADMIN" ? "/admin" : "/operator" });
    }

    // Customer by username
    const customer = await prisma.customer.findFirst({ where: { username: id, isDisabled: false } });
    if (customer && (await verifyPassword(body.password, customer.passwordHash))) {
      await createSession({ subjectType: "CUSTOMER", subjectId: customer.id, tenantId: customer.tenantId, role: "CUSTOMER" });
      await appendAudit(prisma, { tenantId: customer.tenantId, eventType: "CUSTOMER_LOGIN", actorType: "CUSTOMER", actorId: customer.id, source: "auth" });
      return ok({ role: "CUSTOMER", name: customer.fullName, mustChangePassword: customer.mustChangePassword, redirect: "/portale" });
    }

    return fail("AUTH", "Credenziali non valide", 401);
  } catch (e) {
    return handleError(e);
  }
}
