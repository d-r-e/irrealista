export type NumericField = "price" | "areaM2" | "pricePerM2" | "floor";
export interface UtilityPoint { x: number; score: number; }
export interface NumericCriterion { enabled: boolean; weight: number; points: UtilityPoint[]; }
export interface BooleanCriterion { enabled: boolean; weight: number; values: Record<"true" | "false", number>; }
export interface HardFilter { id: string; enabled: boolean; field: NumericField; operator: "<" | "<=" | ">" | ">="; value: number; }
export interface UserPreferences {
  scoringModelVersion: number;
  numeric: Record<NumericField, NumericCriterion>;
  boolean: Record<"elevator" | "exterior", BooleanCriterion>;
  hardFilters: HardFilter[];
}
