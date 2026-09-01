import type { UserPreferences } from "../schemas/preferences";
export const defaultPreferences: UserPreferences = {
  scoringModelVersion: 2,
  numeric: {
    price: { enabled: true, weight: 7, points: [{ x: 180000, score: 100 }, { x: 220000, score: 72 }, { x: 240000, score: 52 }, { x: 270000, score: 20 }, { x: 300000, score: 0 }] },
    areaM2: { enabled: true, weight: 6, points: [{ x: 35, score: 0 }, { x: 40, score: 30 }, { x: 50, score: 65 }, { x: 65, score: 90 }, { x: 80, score: 100 }] },
    pricePerM2: { enabled: true, weight: 15, points: [{ x: 3000, score: 100 }, { x: 4000, score: 82 }, { x: 5000, score: 55 }, { x: 6000, score: 22 }, { x: 7000, score: 0 }] },
    floor: { enabled: true, weight: 4, points: [{ x: 0, score: 45 }, { x: 1, score: 65 }, { x: 2, score: 88 }, { x: 3, score: 100 }, { x: 6, score: 92 }] }
  },
  boolean: { elevator: { enabled: true, weight: 11, values: { true: 100, false: 20 } }, exterior: { enabled: true, weight: 11, values: { true: 100, false: 15 } } },
  hardFilters: [
    { id: "max-price", enabled: false, field: "price", operator: ">", value: 250000 },
    { id: "min-area", enabled: false, field: "areaM2", operator: "<", value: 45 }
  ]
};
