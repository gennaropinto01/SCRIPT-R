// Enum-like unions (SQLite stores them as strings; these are the source of truth).

export const USER_ROLES = ["SUPER_ADMIN", "MILL_ADMIN", "OPERATOR"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LOT_STATUSES = [
  "CREATED", "ACCEPTED", "QUEUED", "SCHEDULED", "IN_PROGRESS", "PAUSED",
  "BLOCKED", "QUALITY_CHECK", "COMPLETED", "READY_FOR_PICKUP", "DELIVERED", "CANCELLED",
] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

export const PHASE_STATUSES = [
  "PENDING", "WAITING", "READY", "RUNNING", "PAUSED", "COMPLETED", "SKIPPED", "FAILED",
] as const;
export type PhaseStatus = (typeof PHASE_STATUSES)[number];

export const MACHINE_STATUSES = [
  "IDLE", "WAITING", "ACTIVE", "PAUSED", "ERROR", "COMPLETED", "MAINTENANCE",
] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export type LotPriority = "NORMAL" | "HIGH" | "URGENT";
export type StageType = "CONTINUOUS" | "BATCH";
export type EtaConfidence = "LOW" | "MEDIUM" | "HIGH";

export const STATUS_LABELS_IT: Record<string, string> = {
  CREATED: "Creato", ACCEPTED: "Accettato", QUEUED: "In coda", SCHEDULED: "Pianificato",
  IN_PROGRESS: "In lavorazione", PAUSED: "In pausa", BLOCKED: "Bloccato",
  QUALITY_CHECK: "Controllo qualità", COMPLETED: "Completato",
  READY_FOR_PICKUP: "Pronto per il ritiro", DELIVERED: "Consegnato", CANCELLED: "Annullato",
};
