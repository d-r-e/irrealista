type Coordinate = [number, number];

const key = (query: string) => `metro-geocode:${encodeURIComponent(query.toLowerCase())}`;

export async function getCachedGeocode(query: string): Promise<Coordinate | null> {
  const stored = await chrome.storage.local.get(key(query));
  const coordinate = stored[key(query)] as Coordinate | undefined;
  return Array.isArray(coordinate) && coordinate.length === 2 ? coordinate : null;
}

export async function saveCachedGeocode(query: string, coordinate: Coordinate): Promise<void> {
  await chrome.storage.local.set({ [key(query)]: coordinate });
}
