import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(1, "Inserisci username o email"),
  password: z.string().min(1, "Inserisci la password"),
});

export const deliverySchema = z.object({
  customerId: z.string().min(1),
  weightKg: z.number().positive("Il peso deve essere positivo"),
  variety: z.string().optional(),
  organic: z.boolean().optional(),
});

export const phaseActionSchema = z.object({
  expectedVersion: z.number().int().optional(),
});

export const oilOutputSchema = z.object({ liters: z.number().positive() });

export const reorderSchema = z.object({
  orderedLotIds: z.array(z.string().min(1)).min(1),
  reason: z.string().min(1, "Motivazione obbligatoria"),
});

export const prioritySchema = z.object({
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]),
  reason: z.string().min(1, "Motivazione obbligatoria"),
});

export const machineStatusSchema = z.object({
  status: z.enum(["IDLE", "WAITING", "ACTIVE", "PAUSED", "ERROR", "COMPLETED", "MAINTENANCE"]),
  reason: z.string().optional(),
});

export const demoControlSchema = z.object({
  action: z.enum(["start", "step", "stop_machine", "restore_machine"]),
  machine: z.string().optional(),
  lotId: z.string().optional(),
});
