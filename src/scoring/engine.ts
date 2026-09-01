import type { PropertyFeatures } from "../schemas/property";
import type { UserPreferences } from "../schemas/preferences";
export interface ScoreContribution { criterion: string; rawValue: unknown; utility: number; weight: number; weightedContribution: number; source: string; confidence: number; }
export interface PropertyScore { score: number | null; dataConfidence: number; contributions: ScoreContribution[]; passed: boolean; failedFilters: string[]; }
function zonedUtility(value: number, zones: UserPreferences["numeric"][keyof UserPreferences["numeric"]]["zones"]): number {
  if (zones.direction === "lower-is-better") return value <= zones.positiveBoundary ? zones.positiveScore : value <= zones.negativeBoundary ? zones.neutralScore : zones.negativeScore;
  return value >= zones.positiveBoundary ? zones.positiveScore : value >= zones.negativeBoundary ? zones.neutralScore : zones.negativeScore;
}
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
    const utility = zonedUtility(feature.value, criterion.zones); contributions.push({ criterion: field, rawValue: feature.value, utility, weight: criterion.weight, weightedContribution: utility * criterion.weight, source: feature.source, confidence: feature.confidence });
  }
  for (const [field, criterion] of Object.entries(preferences.boolean) as [keyof typeof preferences.boolean, typeof preferences.boolean.elevator][]) {
    const feature = property[field]; if (!criterion.enabled || feature.value === null) continue;
    if (field === "elevator") {
      const floor = property.floor.value;
      if (floor === null) continue;
      const access = preferences.floorAccess;
      const utility = floor <= 0 ? access.groundFloor : feature.value ? (floor >= 5 ? access.highFloorWithElevator : access.aboveGroundWithElevator) : floor === 1 ? access.firstFloorWithoutElevator : floor === 2 ? access.secondFloorWithoutElevator : floor === 3 ? access.thirdFloorWithoutElevator : access.fourthFloorOrHigherWithoutElevator;
      contributions.push({ criterion: "floorElevatorAccess", rawValue: `${floor}:${feature.value}`, utility, weight: criterion.weight, weightedContribution: utility * criterion.weight, source: feature.source, confidence: Math.min(feature.confidence, property.floor.confidence) });
      continue;
    }
    const utility = field === "needsRenovation" && feature.value && property.renovationSearch ? Math.max(criterion.values.true, 55) : criterion.values[String(feature.value) as "true" | "false"];
    contributions.push({ criterion: field, rawValue: feature.value, utility, weight: criterion.weight, weightedContribution: utility * criterion.weight, source: feature.source, confidence: feature.confidence });
  }
  const weight = contributions.reduce((sum, item) => sum + item.weight, 0);
  const totalPossible = [...Object.values(preferences.numeric), ...Object.values(preferences.boolean)].filter(c => c.enabled).reduce((sum, c) => sum + c.weight, 0);
  return { score: weight ? Math.round(Math.max(0, Math.min(100, contributions.reduce((sum, item) => sum + item.weightedContribution, 0) / weight))) : null, dataConfidence: totalPossible ? Math.round(100 * contributions.reduce((sum, item) => sum + item.weight * item.confidence, 0) / totalPossible) : 0, contributions, passed: failedFilters.length === 0, failedFilters };
}
