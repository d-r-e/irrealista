import { describe, expect, it } from "vitest";
import { normalizeListing } from "../src/content/idealista-parser";
import { scoreProperty } from "../src/scoring/engine";
import { defaultPreferences } from "../src/scoring/defaults";

const raw = (detailText: string, renovationSearch = false) => ({
  listingId: "signal-test",
  url: "https://www.idealista.com/inmueble/signal-test/",
  price: 220000,
  areaM2: 50,
  rawFeatureTexts: ["Semi-sótano interior", "Sin ascensor"],
  detailText,
  renovationSearch
});

describe("deterministic listing signals", () => {
  it("extracts building, utility and habitability signals from the detail text", () => {
    const property = normalizeListing(raw("Características básicas 50 m² construidos, 35 m² útiles Segunda mano/para reformar Construido en 1915 No dispone de calefacción Orientación norte Consumo: 255 kWh/m² año Terraza Aire acondicionado"));
    expect(property.floor.value).toBe(-1);
    expect(property.yearBuilt.value).toBe(1915);
    expect(property.usableAreaM2.value).toBe(35);
    expect(property.usableAreaRatio.value).toBeCloseTo(0.7);
    expect(property.energyConsumption.value).toBe(255);
    expect(property.heatingQuality.value).toBe(15);
    expect(property.needsRenovation.value).toBe(true);
    expect(property.orientationQuality.value).toBe(35);
    expect(property.hasOutdoorSpace.value).toBe(true);
    expect(property.hasAirConditioning.value).toBe(true);
  });

  it("treats legal use and tenancy as hard warnings", () => {
    const property = normalizeListing(raw("Inmueble actualmente registrado como local, con posibilidad de cambio de uso. Vivienda actualmente alquilada."));
    const score = scoreProperty(property, defaultPreferences);
    expect(score.passed).toBe(false);
    expect(score.failedFilters).toEqual(expect.arrayContaining(["non-residential", "occupied-or-rented"]));
  });

  it("rejects auctions and purchases that cannot be financed with a mortgage", () => {
    const property = normalizeListing(raw("OPORTUNIDAD DE INVERSIÓN — PROPIEDAD EN PROCESO DE SUBASTA. Inmueble sin posesión. Es necesario contar con liquidez, ya que no se puede financiar con una hipoteca. Registralmente la finca figura como local."));
    const score = scoreProperty(property, defaultPreferences);
    expect(property.isAuctionOrCashOnly.value).toBe(true);
    expect(score.passed).toBe(false);
    expect(score.failedFilters).toEqual(expect.arrayContaining(["auction-or-cash-only", "occupied-or-rented", "non-residential"]));
  });

  it("rejects properties without a habitability certificate", () => {
    const property = normalizeListing(raw("LOFT DÚPLEX completamente reformado, sin cédula, en el Barrio del Pilar."));
    const score = scoreProperty(property, defaultPreferences);
    expect(property.lacksHabitabilityCertificate.value).toBe(true);
    expect(score.passed).toBe(false);
    expect(score.failedFilters).toContain("no-habitability-certificate");
  });

  it("softens the renovation penalty for the dedicated renovation search", () => {
    const standard = scoreProperty(normalizeListing(raw("Segunda mano/para reformar")), defaultPreferences);
    const renovation = scoreProperty(normalizeListing(raw("Segunda mano/para reformar", true)), defaultPreferences);
    expect(renovation.contributions.find(item => item.criterion === "needsRenovation")?.utility).toBeGreaterThan(standard.contributions.find(item => item.criterion === "needsRenovation")?.utility ?? 0);
  });

  it("recognizes 'para actualizar' as a renovation signal and lowers the score", () => {
    const updated = scoreProperty(normalizeListing(raw("Segunda mano/buen estado. Lista para entrar a vivir.")), defaultPreferences);
    const needsUpdatingProperty = normalizeListing(raw("Vivienda para actualizar con muchas posibilidades."));
    const needsUpdating = scoreProperty(needsUpdatingProperty, defaultPreferences);

    expect(needsUpdatingProperty.needsRenovation.value).toBe(true);
    expect(needsUpdating.contributions.find(item => item.criterion === "needsRenovation")?.utility).toBe(10);
    expect(needsUpdating.score).toBeLessThan(updated.score ?? 100);
  });

  it("makes basement and semi-basement floors subtract points", () => {
    const basement = scoreProperty(normalizeListing(raw("Vivienda semisótano interior.")), defaultPreferences);
    const floor = basement.contributions.find(item => item.criterion === "floor");

    expect(floor?.rawValue).toBe(-1);
    expect(floor?.utility).toBeLessThan(0);
    expect(floor?.weightedContribution).toBeLessThan(0);
  });
});
