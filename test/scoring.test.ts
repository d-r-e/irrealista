import { describe, expect, it } from "vitest";
import { defaultPreferences } from "../src/scoring/defaults";
import { scoreProperty } from "../src/scoring/engine";
import type { PropertyFeatures } from "../src/schemas/property";
const feature = <T>(value: T | null) => ({ value, source: "idealista_dom" as const, confidence: value === null ? 0 : 1 });
const property: PropertyFeatures = { listingId: "1", url: "https://example.test/1", price: feature(220000), areaM2: feature(60), pricePerM2: feature(3667), floor: feature(null), isGroundFloor: feature(null), elevator: feature(true), exterior: feature(true), yearBuilt: feature(null), usableAreaM2: feature(null), usableAreaRatio: feature(null), energyConsumption: feature(null), heatingQuality: feature(null), needsRenovation: feature(null), orientationQuality: feature(null), hasOutdoorSpace: feature(null), hasStorage: feature(null), hasAirConditioning: feature(null), streetLevelAccess: feature(null), isNonResidential: feature(null), hasTenant: feature(null), isAuctionOrCashOnly: feature(null), lacksHabitabilityCertificate: feature(null), hasNonStandardBedroom: feature(null), renovationSearch: false };
describe("scoreProperty", () => { it("omits unknown values instead of assigning zero", () => { const result = scoreProperty(property, defaultPreferences); expect(result.score).not.toBeNull(); expect(result.contributions.some(c => c.criterion === "floor")).toBe(false); }); it("reports a hard-filter failure", () => { const prefs = structuredClone(defaultPreferences); prefs.hardFilters[0].enabled = true; prefs.hardFilters[0].value = 200000; expect(scoreProperty(property, prefs).passed).toBe(false); }); });

describe("floor and elevator", () => {
  const withFloor = (floor: number, elevator: boolean): PropertyFeatures => ({ ...property, floor: feature(floor), elevator: feature(elevator) });

  it("uses the lift as a bonus from the first floor onwards", () => {
    const groundWithLift = scoreProperty(withFloor(0, true), defaultPreferences);
    const groundWithoutLift = scoreProperty(withFloor(0, false), defaultPreferences);
    const firstWithLift = scoreProperty(withFloor(1, true), defaultPreferences);
    expect(groundWithLift.contributions.find(c => c.criterion === "floorElevatorAccess")?.utility).toBe(55);
    expect(groundWithoutLift.contributions.find(c => c.criterion === "floorElevatorAccess")?.utility).toBe(55);
    expect(firstWithLift.contributions.find(c => c.criterion === "floorElevatorAccess")?.utility).toBe(100);
  });

  it("values height independently but lets a difficult walk-up dominate the total", () => {
    const ground = scoreProperty(withFloor(0, false), defaultPreferences);
    const third = scoreProperty(withFloor(3, false), defaultPreferences);
    expect(third.contributions.find(c => c.criterion === "floor")?.utility).toBeGreaterThan(ground.contributions.find(c => c.criterion === "floor")?.utility ?? 0);
    expect(third.score).toBeLessThan(ground.score ?? 0);
  });
});

describe("weight hierarchy", () => {
  it("makes price per square metre materially affect the result", () => {
    const cheap = scoreProperty({ ...property, pricePerM2: feature(3000) }, defaultPreferences);
    const expensive = scoreProperty({ ...property, pricePerM2: feature(7000) }, defaultPreferences);
    expect((cheap.score ?? 0) - (expensive.score ?? 0)).toBeGreaterThanOrEqual(15);
  });

  it("makes renovation a major penalty outside the renovation search", () => {
    const ready = scoreProperty({ ...property, needsRenovation: feature(false) }, defaultPreferences);
    const renovation = scoreProperty({ ...property, needsRenovation: feature(true) }, defaultPreferences);
    expect((ready.score ?? 0) - (renovation.score ?? 0)).toBeGreaterThanOrEqual(15);
  });
});
