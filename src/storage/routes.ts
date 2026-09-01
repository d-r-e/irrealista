import type { MetroRoute } from "../shared/metro";

const key = (listingId: string) => `metro-route:${listingId}`;

interface CachedMetroRoute extends MetroRoute { sourceHash: string; cachedAt: string; }

export async function getCachedMetroRoute(listingId: string, sourceHash: string): Promise<MetroRoute | null> {
  const stored = await chrome.storage.local.get(key(listingId));
  const route = stored[key(listingId)] as CachedMetroRoute | undefined;
  return route?.sourceHash === sourceHash && Array.isArray(route.lines) ? route : null;
}

export async function saveCachedMetroRoute(listingId: string, sourceHash: string, route: MetroRoute): Promise<void> {
  await chrome.storage.local.set({ [key(listingId)]: { ...route, sourceHash, cachedAt: new Date().toISOString() } satisfies CachedMetroRoute });
}
