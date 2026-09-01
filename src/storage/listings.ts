import type { IdealistaListingRaw, PropertyFeatures } from "../schemas/property";
import type { PropertyScore } from "../scoring/engine";
export interface CachedListing { listingId: string; sourceHash: string; raw: IdealistaListingRaw; normalized: PropertyFeatures; score: PropertyScore; cachedAt: string; schemaVersion: number; }
const key = (id: string) => `idealista:${id}`;
export async function getCachedListing(id: string, sourceHash: string): Promise<CachedListing | null> { const found = (await chrome.storage.local.get(key(id)))[key(id)] as CachedListing | undefined; return found?.sourceHash === sourceHash && found.schemaVersion === 5 ? found : null; }
export async function saveCachedListing(listing: CachedListing): Promise<void> { await chrome.storage.local.set({ [key(listing.listingId)]: listing }); }
export function sourceHash(raw: IdealistaListingRaw): string { return [raw.title, raw.description, raw.detailText, raw.price, raw.areaM2, raw.pricePerM2, raw.floorText, raw.renovationSearch, ...raw.rawFeatureTexts].join("|"); }
