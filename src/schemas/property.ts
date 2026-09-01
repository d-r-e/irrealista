export type FeatureSource = "idealista_dom" | "idealista_text" | "llm" | "geospatial" | "computed";
export interface Feature<T> { value: T | null; source: FeatureSource; confidence: number; }
export interface IdealistaListingRaw {
  listingId: string; url: string; title?: string; description?: string; price?: number; areaM2?: number;
  pricePerM2?: number; floorText?: string; elevator?: boolean; exterior?: boolean; rawFeatureTexts: string[];
  detailText?: string;
  renovationSearch?: boolean;
}
export interface PropertyFeatures {
  listingId: string; url: string; price: Feature<number>; areaM2: Feature<number>; pricePerM2: Feature<number>;
  floor: Feature<number>; isGroundFloor: Feature<boolean>; elevator: Feature<boolean>; exterior: Feature<boolean>;
  yearBuilt: Feature<number>;
  usableAreaM2: Feature<number>;
  usableAreaRatio: Feature<number>;
  energyConsumption: Feature<number>;
  heatingQuality: Feature<number>;
  needsRenovation: Feature<boolean>;
  orientationQuality: Feature<number>;
  hasOutdoorSpace: Feature<boolean>;
  hasStorage: Feature<boolean>;
  hasAirConditioning: Feature<boolean>;
  streetLevelAccess: Feature<boolean>;
  isNonResidential: Feature<boolean>;
  hasTenant: Feature<boolean>;
  isAuctionOrCashOnly: Feature<boolean>;
  lacksHabitabilityCertificate: Feature<boolean>;
  hasNonStandardBedroom: Feature<boolean>;
  renovationSearch: boolean;
}
