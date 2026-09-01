import type { RouteApiConfig } from "../shared/config";
import type { MetroLine, MetroRoute } from "../shared/metro";
import { getCachedGeocode, saveCachedGeocode } from "../storage/geocodes";
import { METRO_LINES, METRO_STATIONS, type MetroStation } from "../data/metro-stations";

type Coordinate = [number, number];
interface Station { name: string; coordinate: Coordinate; lines: MetroLine[]; }

const withoutTrailingSlash = (value: string) => value.replace(/\/$/, "");
let geocodeQueue: Promise<unknown> = Promise.resolve();
let lastGeocodeRequestAt = 0;

async function requestGeocode(query: string, config: RouteApiConfig): Promise<Coordinate | null> {
  const cached = await getCachedGeocode(query);
  if (cached) return cached;
  const task = geocodeQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    const url = new URL(`${withoutTrailingSlash(config.nominatimBaseUrl)}/search`);
    url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", countrycodes: "es" }).toString();
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    lastGeocodeRequestAt = Date.now();
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}.`);
    const result = await response.json() as Array<{ lat: string; lon: string }>;
    const first = result[0];
    if (!first) return null;
    const coordinate: Coordinate = [Number(first.lon), Number(first.lat)];
    await saveCachedGeocode(query, coordinate);
    return coordinate;
  });
  geocodeQueue = task.catch(() => undefined);
  return task;
}

function geocodeQueries(listingTitle: string): string[] {
  const address = listingTitle
    .replace(/^(?:piso|dúplex|duplex|ático|atico|estudio|casa|chalet(?:\s+adosado)?)\s+en\s+/i, "")
    .trim();
  const parts = address.split(",").map(part => part.trim()).filter(Boolean);
  const city = parts.at(-1)?.toLocaleLowerCase("es") === "madrid" ? parts.at(-1)! : "Madrid";
  const neighborhood = parts.length >= 3 ? parts.at(-2) : undefined;
  const streetWithoutNumber = parts[0]?.replace(/,?\s+\d+[A-Za-zºª-]*\s*$/, "");
  return [...new Set([
    address,
    parts.length >= 2 ? [streetWithoutNumber, ...parts.slice(1)].join(", ") : undefined,
    neighborhood ? `${neighborhood}, ${city}` : undefined,
    streetWithoutNumber ? `${streetWithoutNumber}, ${city}` : undefined
  ].filter((query): query is string => Boolean(query)))];
}

async function geocode(query: string, config: RouteApiConfig): Promise<Coordinate | null> {
  const cached = await getCachedGeocode(query);
  if (cached) return cached;
  for (const candidate of geocodeQueries(query)) {
    const coordinate = await requestGeocode(candidate, config);
    if (!coordinate) continue;
    await saveCachedGeocode(query, coordinate);
    return coordinate;
  }
  return null;
}

function distanceSquared(origin: Coordinate, station: MetroStation): number {
  const latitudeScale = Math.cos(origin[1] * Math.PI / 180);
  const longitudeDelta = (station[1] - origin[0]) * latitudeScale;
  const latitudeDelta = station[2] - origin[1];
  return longitudeDelta * longitudeDelta + latitudeDelta * latitudeDelta;
}

function nearbyStations(origin: Coordinate): Station[] {
  return [...METRO_STATIONS]
    .sort((a, b) => distanceSquared(origin, a) - distanceSquared(origin, b))
    .slice(0, 5)
    .map(([name, longitude, latitude, lineNames]) => ({
      name,
      coordinate: [longitude, latitude],
      lines: lineNames.map(lineName => METRO_LINES[lineName]).filter((line): line is MetroLine => Boolean(line))
    }));
}

export async function calculateMetroRoute(locationQuery: string, config: RouteApiConfig): Promise<MetroRoute | null> {
  if (!config.openRouteServiceApiKey) return null;
  const origin = await geocode(locationQuery, config);
  if (!origin) return null;
  const stations = nearbyStations(origin);
  if (!stations.length) return null;
  const response = await fetch(`${withoutTrailingSlash(config.openRouteServiceBaseUrl)}/v2/matrix/foot-walking`, { method: "POST", headers: { Authorization: config.openRouteServiceApiKey, "Content-Type": "application/json" }, body: JSON.stringify({ locations: [origin, ...stations.map(station => station.coordinate)], metrics: ["distance", "duration"], sources: [0], destinations: stations.map((_, index) => index + 1) }) });
  if (!response.ok) {
    const body = await response.text();
    let detail = "";
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
      detail = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message ?? "";
    } catch { detail = body; }
    const safeDetail = detail.replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(`OpenRouteService ${response.status}${safeDetail ? `: ${safeDetail}` : ""}`);
  }
  const matrix = await response.json() as { distances?: Array<Array<number | null>>; durations?: Array<Array<number | null>> };
  const distances = matrix.distances?.[0] ?? []; const durations = matrix.durations?.[0] ?? [];
  const routes = stations.map((station, index) => ({ stationName: station.name, distanceMeters: distances[index], durationSeconds: durations[index], lines: station.lines })).filter((route): route is MetroRoute => typeof route.distanceMeters === "number" && typeof route.durationSeconds === "number");
  return routes.sort((a, b) => a.durationSeconds - b.durationSeconds)[0] ?? null;
}
