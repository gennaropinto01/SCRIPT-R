import { NextResponse } from "next/server";
import { AuthError } from "./auth";
import { ConflictError, NotFoundError } from "./lots";
import { StateError } from "./stateMachine";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

// Maps thrown errors to correct HTTP responses. Never swallows errors silently.
export function handleError(e: unknown) {
  if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
  if (e instanceof ZodError) return fail("VALIDATION", "Dati non validi", 400, e.flatten());
  if (e instanceof ConflictError) return fail("CONFLICT", e.message, 409);
  if (e instanceof NotFoundError) return fail("NOT_FOUND", e.message, 404);
  if (e instanceof StateError) return fail("STATE_ERROR", e.message, 422);
  const message = e instanceof Error ? e.message : "Errore interno";
  console.error("[api] unhandled error:", e);
  return fail("INTERNAL", message, 500);
}
