import type { UserPreferences } from "../schemas/preferences";
export const defaultPreferences: UserPreferences = {
  scoringModelVersion: 4,
  numeric: {
    price: { enabled: true, weight: 7, points: [], zones: { direction: "lower-is-better", positiveBoundary: 200000, negativeBoundary: 250000, negativeScore: -50, neutralScore: 50, positiveScore: 100 } },
    areaM2: { enabled: true, weight: 6, points: [], zones: { direction: "higher-is-better", positiveBoundary: 60, negativeBoundary: 40, negativeScore: -35, neutralScore: 50, positiveScore: 100 } },
    pricePerM2: { enabled: true, weight: 15, points: [], zones: { direction: "lower-is-better", positiveBoundary: 4000, negativeBoundary: 6000, negativeScore: -50, neutralScore: 50, positiveScore: 100 } },
    floor: { enabled: true, weight: 4, points: [], zones: { direction: "higher-is-better", positiveBoundary: 2, negativeBoundary: 0, negativeScore: -70, neutralScore: 50, positiveScore: 100 } },
    yearBuilt: { enabled: true, weight: 2, points: [], zones: { direction: "higher-is-better", positiveBoundary: 2000, negativeBoundary: 1940, negativeScore: -20, neutralScore: 55, positiveScore: 100 } },
    usableAreaRatio: { enabled: true, weight: 6, points: [], zones: { direction: "higher-is-better", positiveBoundary: 0.82, negativeBoundary: 0.65, negativeScore: -25, neutralScore: 50, positiveScore: 100 } },
    energyConsumption: { enabled: true, weight: 3, points: [], zones: { direction: "lower-is-better", positiveBoundary: 120, negativeBoundary: 280, negativeScore: -25, neutralScore: 50, positiveScore: 100 } },
    heatingQuality: { enabled: true, weight: 4, points: [], zones: { direction: "higher-is-better", positiveBoundary: 75, negativeBoundary: 30, negativeScore: -30, neutralScore: 50, positiveScore: 100 } },
    orientationQuality: { enabled: true, weight: 3, points: [], zones: { direction: "higher-is-better", positiveBoundary: 85, negativeBoundary: 50, negativeScore: -20, neutralScore: 55, positiveScore: 100 } }
  },
  boolean: {
    elevator: { enabled: true, weight: 11, values: { true: 100, false: 20 } }, exterior: { enabled: true, weight: 11, values: { true: 100, false: 15 } },
    needsRenovation: { enabled: true, weight: 13, values: { true: 10, false: 100 } }, hasOutdoorSpace: { enabled: true, weight: 2, values: { true: 100, false: 50 } },
    hasStorage: { enabled: true, weight: 1, values: { true: 100, false: 50 } }, hasAirConditioning: { enabled: true, weight: 1, values: { true: 100, false: 50 } },
    streetLevelAccess: { enabled: true, weight: 7, values: { true: 30, false: 100 } }, hasNonStandardBedroom: { enabled: true, weight: 9, values: { true: 10, false: 100 } }
  },
  floorAccess: { groundFloor: 55, aboveGroundWithElevator: 100, highFloorWithElevator: 95, firstFloorWithoutElevator: 65, secondFloorWithoutElevator: 38, thirdFloorWithoutElevator: 12, fourthFloorOrHigherWithoutElevator: 0 },
  hardFilters: [
    { id: "max-price", enabled: false, field: "price", operator: ">", value: 250000 },
    { id: "min-area", enabled: false, field: "areaM2", operator: "<", value: 45 }
  ]
};
