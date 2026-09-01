export type NumericField = "price" | "areaM2" | "pricePerM2" | "floor" | "yearBuilt" | "usableAreaRatio" | "energyConsumption" | "heatingQuality" | "orientationQuality";
export type BooleanField = "elevator" | "exterior" | "needsRenovation" | "hasOutdoorSpace" | "hasStorage" | "hasAirConditioning" | "streetLevelAccess" | "hasNonStandardBedroom";
export interface UtilityPoint { x: number; score: number; }
export interface ScoreZones { direction: "lower-is-better" | "higher-is-better"; positiveBoundary: number; negativeBoundary: number; negativeScore: number; neutralScore: number; positiveScore: number; }
export interface NumericCriterion { enabled: boolean; weight: number; points: UtilityPoint[]; zones: ScoreZones; }
export interface BooleanCriterion { enabled: boolean; weight: number; values: Record<"true" | "false", number>; }
export interface FloorAccessSettings { groundFloor: number; aboveGroundWithElevator: number; highFloorWithElevator: number; firstFloorWithoutElevator: number; secondFloorWithoutElevator: number; thirdFloorWithoutElevator: number; fourthFloorOrHigherWithoutElevator: number; }
export interface HardFilter { id: string; enabled: boolean; field: NumericField; operator: "<" | "<=" | ">" | ">="; value: number; }
export interface UserPreferences {
  scoringModelVersion: number;
  numeric: Record<NumericField, NumericCriterion>;
  boolean: Record<BooleanField, BooleanCriterion>;
  floorAccess: FloorAccessSettings;
  hardFilters: HardFilter[];
}
