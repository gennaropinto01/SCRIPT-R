import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { UserRole } from "./types";

export const SESSION_COOKIE = "oleificio_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8h

export type SubjectType = "USER" | "CUSTOMER";

export interface Principal {
  sessionId: string;
  subjectType: SubjectType;
  subjectId: string;
  tenantId: string | null;
  role: string; // UserRole | "CUSTOMER"
}

// Production uses Argon2id (see security-model.md); bcryptjs is used here for a
// dependency-light, guaranteed-to-run build. The hashing calls are abstracted.
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(params: {
  subjectType: SubjectType;
  subjectId: string;
  tenantId: string | null;
  role: string;
}): Promise<string> {
  const session = await prisma.session.create({
    data: {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      tenantId: params.tenantId,
      role: params.role,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return session.id;
}

export async function getPrincipal(): Promise<Principal | null> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const session = await prisma.session.findUnique({ where: { id: sid } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return {
    sessionId: session.id,
    subjectType: session.subjectType as SubjectType,
    subjectId: session.subjectId,
    tenantId: session.tenantId,
    role: session.role,
  };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (sid) {
    await prisma.session.updateMany({ where: { id: sid }, data: { revokedAt: new Date() } }).catch(() => {});
    store.delete(SESSION_COOKIE);
  }
}

// ---- Authorization guards (throw on failure; caller maps to HTTP status) ----

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export async function requirePrincipal(): Promise<Principal> {
  const p = await getPrincipal();
  if (!p) throw new AuthError(401, "Autenticazione richiesta");
  return p;
}

export async function requireUser(roles?: UserRole[]): Promise<Principal> {
  const p = await requirePrincipal();
  if (p.subjectType !== "USER") throw new AuthError(403, "Accesso riservato allo staff");
  if (roles && !roles.includes(p.role as UserRole)) throw new AuthError(403, "Permesso negato");
  return p;
}

export async function requireCustomer(): Promise<Principal & { tenantId: string }> {
  const p = await requirePrincipal();
  if (p.subjectType !== "CUSTOMER" || !p.tenantId) throw new AuthError(403, "Accesso riservato ai clienti");
  return p as Principal & { tenantId: string };
}
