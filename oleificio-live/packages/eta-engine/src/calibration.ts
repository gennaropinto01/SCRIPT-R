import { clamp } from "./durations.js";

export interface CalibrationObservation {
  estimatedMinutes: number;
  actualMinutes: number;
}

export interface CalibrationResult {
  applied: boolean;
  newEfficiencyFactor: number;
  observations: number;
  reason: string;
}

/**
 * Update efficiencyFactor via a weighted moving average, gated by a minimum
 * number of observations. No uncontrolled jumps; history is kept by the caller.
 *
 * observedEfficiency = estimated / actual  (if we overestimated time, machine is
 * faster than assumed → efficiency > prior; if it took longer → efficiency < prior).
 */
export function updateEfficiencyFactor(params: {
  priorEfficiency: number;
  observations: CalibrationObservation[];
  minObservations: number;
  priorWeight?: number;
  minBound?: number;
  maxBound?: number;
}): CalibrationResult {
  const {
    priorEfficiency,
    observations,
    minObservations,
    priorWeight = 5,
    minBound = 0.3,
    maxBound = 1.5,
  } = params;

  if (observations.length < minObservations) {
    return {
      applied: false,
      newEfficiencyFactor: priorEfficiency,
      observations: observations.length,
      reason: `Need >= ${minObservations} observations, have ${observations.length}`,
    };
  }

  let observedSum = 0;
  let obsCount = 0;
  for (const o of observations) {
    if (o.actualMinutes <= 0 || o.estimatedMinutes <= 0) continue;
    // observedEfficiency relative to the prior assumption:
    observedSum += priorEfficiency * (o.estimatedMinutes / o.actualMinutes);
    obsCount += 1;
  }
  if (obsCount === 0) {
    return {
      applied: false,
      newEfficiencyFactor: priorEfficiency,
      observations: 0,
      reason: "No valid observations",
    };
  }

  const observedEfficiency = observedSum / obsCount;
  const obsWeight = obsCount;
  const blended =
    (priorWeight * priorEfficiency + obsWeight * observedEfficiency) /
    (priorWeight + obsWeight);

  return {
    applied: true,
    newEfficiencyFactor: clamp(blended, minBound, maxBound),
    observations: obsCount,
    reason: "Applied weighted moving average",
  };
}
