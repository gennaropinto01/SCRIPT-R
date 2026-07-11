import type { LotStatus, PhaseStatus } from "./types";

// Explicit lot state machine. Invalid transitions are rejected.
const LOT_TRANSITIONS: Record<LotStatus, LotStatus[]> = {
  CREATED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["QUEUED", "CANCELLED"],
  QUEUED: ["SCHEDULED", "IN_PROGRESS", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PAUSED", "BLOCKED", "QUALITY_CHECK", "COMPLETED", "CANCELLED"],
  PAUSED: ["IN_PROGRESS", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  QUALITY_CHECK: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const PHASE_TRANSITIONS: Record<PhaseStatus, PhaseStatus[]> = {
  PENDING: ["WAITING", "READY", "SKIPPED"],
  WAITING: ["READY", "SKIPPED"],
  READY: ["RUNNING", "SKIPPED"],
  RUNNING: ["PAUSED", "COMPLETED", "FAILED"],
  PAUSED: ["RUNNING", "FAILED"],
  COMPLETED: [],
  SKIPPED: [],
  FAILED: ["READY"],
};

export function canTransitionLot(from: LotStatus, to: LotStatus): boolean {
  return LOT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertLotTransition(from: LotStatus, to: LotStatus): void {
  if (!canTransitionLot(from, to)) {
    throw new StateError(`Transizione lotto non valida: ${from} → ${to}`);
  }
}

export function canTransitionPhase(from: PhaseStatus, to: PhaseStatus): boolean {
  return PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertPhaseTransition(from: PhaseStatus, to: PhaseStatus): void {
  if (!canTransitionPhase(from, to)) {
    throw new StateError(`Transizione fase non valida: ${from} → ${to}`);
  }
}

export class StateError extends Error {
  readonly code = "STATE_ERROR";
}
