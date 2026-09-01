import type { PropertyFeatures } from "../schemas/property";
import type { UserPreferences } from "../schemas/preferences";
import { piecewiseUtility } from "./utility";
export interface ScoreContribution { criterion: string; rawValue: unknown; utility: number; weight: number; weightedContribution: number; source: string; confidence: number; }
export interface PropertyScore { score: number | null; dataConfidence: number; contributions: ScoreContribution[]; passed: boolean; failedFilters: string[]; }
const fixedNumericCriteria = [
  { field: "yearBuilt", weight: 2, points: [{ x: 1900, score: 40 }, { x: 1940, score: 50 }, { x: 1960, score: 65 }, { x: 1980, score: 78 }, { x: 2000, score: 92 }, { x: 2025, score: 100 }] },
  { field: "usableAreaRatio", weight: 6, points: [{ x: 0.55, score: 0 }, { x: 0.7, score: 45 }, { x: 0.82, score: 85 }, { x: 0.95, score: 100 }] },
  { field: "energyConsumption", weight: 3, points: [{ x: 60, score: 100 }, { x: 150, score: 80 }, { x: 250, score: 50 }, { x: 350, score: 20 }, { x: 500, score: 0 }] },
  { field: "heatingQuality", weight: 4, points: [{ x: 0, score: 0 }, { x: 15, score: 15 }, { x: 70, score: 70 }, { x: 100, score: 100 }] },
  { field: "orientationQuality", weight: 3, points: [{ x: 0, score: 0 }, { x: 35, score: 35 }, { x: 75, score: 75 }, { x: 100, score: 100 }] }
] as const;
const fixedBooleanCriteria = [
  { field: "needsRenovation", weight: 13, utility: (value: boolean, renovationSearch: boolean) => value ? (renovationSearch ? 55 : 10) : 100 },
  { field: "hasOutdoorSpace", weight: 2, utility: (value: boolean) => value ? 100 : 50 },
  { field: "hasStorage", weight: 1, utility: (value: boolean) => value ? 100 : 50 },
  { field: "hasAirConditioning", weight: 1, utility: (value: boolean) => value ? 100 : 50 },
  { field: "streetLevelAccess", weight: 7, utility: (value: boolean) => value ? 30 : 100 },
  { field: "hasNonStandardBedroom", weight: 9, utility: (value: boolean) => value ? 10 : 100 }
] as const;
export function scoreProperty(property: PropertyFeatures, preferences: UserPreferences): PropertyScore {
  const failedFilters = preferences.hardFilters.filter(f => {
    if (!f.enabled) return false; const v = property[f.field].value; if (v === null) return false;
    return f.operator === ">" ? v > f.value : f.operator === ">=" ? v >= f.value : f.operator === "<" ? v < f.value : v <= f.value;
  }).map(f => f.id);
  if (property.isNonResidential.value) failedFilters.push("non-residential");
  if (property.hasTenant.value) failedFilters.push("occupied-or-rented");
  if (property.isAuctionOrCashOnly.value) failedFilters.push("auction-or-cash-only");
  if (property.lacksHabitabilityCertificate.value) failedFilters.push("no-habitability-certificate");
  const contributions: ScoreContribution[] = [];
  for (const [field, criterion] of Object.entries(preferences.numeric) as [keyof typeof preferences.numeric, typeof preferences.numeric.price][]) {
    const feature = property[field]; if (!criterion.enabled || feature.value === null) continue;
    const utility = field === "floor" && feature.value < 0 ? piecewiseUtility(feature.value, [{ x: -2, score: 0 }, { x: -1, score: 10 }, { x: -0.5, score: 25 }, { x: 0, score: 40 }]) : piecewiseUtility(feature.value, criterion.points); contributions.push({ criterion: field, rawValue: feature.value, utility, weight: criterion.weight, weightedContribution: utility * criterion.weight, source: feature.source, confidence: feature.confidence });
  }
  for (const [field, criterion] of Object.entries(preferences.boolean) as [keyof typeof preferences.boolean, typeof preferences.boolean.elevator][]) {
    const feature = property[field]; if (!criterion.enabled || feature.value === null) continue;
    if (field === "elevator") {
      const floor = property.floor.value;
      if (floor === null) continue;
      const utility = floor <= 0 ? 55 : feature.value ? (floor >= 5 ? 95 : 100) : floor === 1 ? 65 : floor === 2 ? 38 : floor === 3 ? 12 : 0;
      contributions.push({ criterion: "floorElevatorAccess", rawValue: `${floor}:${feature.value}`, utility, weight: criterion.weight, weightedContribution: utility * criterion.weight, source: feature.source, confidence: Math.min(feature.confidence, property.floor.confidence) });
      continue;
    }
    const utility = criterion.values[String(feature.value) as "true" | "false"]; contributions.push({ criterion: field, rawValue: feature.value, utility, weight: criterion.weight, weightedContribution: utility * criterion.weight, source: feature.source, confidence: feature.confidence });
  }
  for (const criterion of fixedNumericCriteria) {
    const feature = property[criterion.field];
    if (feature.value === null) continue;
    const utility = piecewiseUtility(feature.value, criterion.points);
    contributions.push({ criterion: criterion.field, rawValue: feature.value, utility, weight: criterion.weight, weightedContribution: utility * criterion.weight, source: feature.source, confidence: feature.confidence });
  }
  for (const criterion of fixedBooleanCriteria) {
    const feature = property[criterion.field];
    if (feature.value === null) continue;
    const utility = criterion.utility(feature.value, property.renovationSearch);
    contributions.push({ criterion: criterion.field, rawValue: feature.value, utility, weight: criterion.weight, weightedContribution: utility * criterion.weight, source: feature.source, confidence: feature.confidence });
  }
  const weight = contributions.reduce((sum, item) => sum + item.weight, 0);
  const totalPossible = [...Object.values(preferences.numeric), ...Object.values(preferences.boolean)].filter(c => c.enabled).reduce((sum, c) => sum + c.weight, 0) + fixedNumericCriteria.reduce((sum, c) => sum + c.weight, 0) + fixedBooleanCriteria.reduce((sum, c) => sum + c.weight, 0);
  return { score: weight ? Math.round(Math.max(0, Math.min(100, contributions.reduce((sum, item) => sum + item.weightedContribution, 0) / weight))) : null, dataConfidence: totalPossible ? Math.round(100 * contributions.reduce((sum, item) => sum + item.weight * item.confidence, 0) / totalPossible) : 0, contributions, passed: failedFilters.length === 0, failedFilters };
}
