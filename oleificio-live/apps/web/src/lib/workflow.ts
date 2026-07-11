import type { StageType } from "./types";

// Default production workflow. All values are DEMO defaults, editable per tenant.
// animationKey drives the 3D scene and the customer message.

export interface StageSeed {
  code: string;
  name: string;
  customerDescription: string;
  stageType: StageType;
  isOptional: boolean;
  setupMinutes: number;
  cleanupMinutes: number;
  overlapMinutes: number;
  averageMinutes?: number;
  averageBatchDurationMinutes?: number;
  allowsParallelProcessing: boolean;
  animationKey: string;
}

export const DEFAULT_STAGES: StageSeed[] = [
  { code: "ACCEPTANCE", name: "Accettazione e pesatura", customerDescription: "Le tue olive sono state accettate e pesate all'ingresso.", stageType: "CONTINUOUS", isOptional: false, setupMinutes: 2, cleanupMinutes: 0, overlapMinutes: 0, averageMinutes: 10, allowsParallelProcessing: false, animationKey: "acceptance" },
  { code: "DEFOLIATION", name: "Defogliazione", customerDescription: "Foglie e rametti vengono separati dalle olive.", stageType: "CONTINUOUS", isOptional: false, setupMinutes: 2, cleanupMinutes: 2, overlapMinutes: 3, averageMinutes: undefined, allowsParallelProcessing: true, animationKey: "defoliation" },
  { code: "WASHING", name: "Lavaggio", customerDescription: "Le olive vengono lavate con acqua per rimuovere polvere e residui.", stageType: "CONTINUOUS", isOptional: false, setupMinutes: 2, cleanupMinutes: 3, overlapMinutes: 3, allowsParallelProcessing: true, animationKey: "washing" },
  { code: "CRUSHING", name: "Frangitura", customerDescription: "Le olive entrano nel frangitore e vengono trasformate in pasta per facilitare l'estrazione dell'olio.", stageType: "CONTINUOUS", isOptional: false, setupMinutes: 3, cleanupMinutes: 5, overlapMinutes: 0, allowsParallelProcessing: false, animationKey: "crushing" },
  { code: "MALAXING", name: "Gramolazione", customerDescription: "La pasta viene mescolata lentamente nella gramola: le piccole gocce d'olio si uniscono e diventano più facili da separare.", stageType: "BATCH", isOptional: false, setupMinutes: 5, cleanupMinutes: 5, overlapMinutes: 0, averageBatchDurationMinutes: 40, allowsParallelProcessing: false, animationKey: "malaxing" },
  { code: "DECANTER", name: "Estrazione (decanter)", customerDescription: "La pasta attraversa il decanter centrifugo, che separa la parte oleosa dalle componenti solide e acquose.", stageType: "CONTINUOUS", isOptional: false, setupMinutes: 3, cleanupMinutes: 5, overlapMinutes: 0, allowsParallelProcessing: false, animationKey: "decanter" },
  { code: "SEPARATION", name: "Separazione verticale", customerDescription: "Il separatore verticale rifinisce la separazione dell'olio dall'acqua residua.", stageType: "CONTINUOUS", isOptional: false, setupMinutes: 2, cleanupMinutes: 3, overlapMinutes: 0, allowsParallelProcessing: false, animationKey: "separation" },
  { code: "FILTRATION", name: "Filtrazione", customerDescription: "L'olio viene filtrato per renderlo limpido (fase facoltativa).", stageType: "CONTINUOUS", isOptional: true, setupMinutes: 2, cleanupMinutes: 2, overlapMinutes: 0, allowsParallelProcessing: false, animationKey: "filtration" },
  { code: "STORAGE", name: "Stoccaggio e misurazione", customerDescription: "L'olio viene stoccato e misurato: si calcola la resa ottenuta.", stageType: "CONTINUOUS", isOptional: false, setupMinutes: 5, cleanupMinutes: 0, overlapMinutes: 0, averageMinutes: 10, allowsParallelProcessing: false, animationKey: "storage" },
];

// Typical olive->oil yield used only for the initial estimate (real value measured later).
export const DEFAULT_YIELD_PERCENTAGE = 15;
