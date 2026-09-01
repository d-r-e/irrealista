import type { ExtensionMessage, EnrichedPropertyResponse } from "../shared/messages";
import { normalizeListing } from "../content/idealista-parser";
import { scoreProperty } from "../scoring/engine";
import { getPreferences, savePreferences } from "../storage/preferences";
import { getCachedListing, saveCachedListing, sourceHash } from "../storage/listings";
import { getRouteApiConfig, saveRouteApiConfig } from "../storage/routes-config";
import { getCachedMetroRoute, saveCachedMetroRoute } from "../storage/routes";
import { calculateMetroRoute } from "../routing/metro";
import type { MetroRouteResult } from "../shared/metro";

async function metroRouteForListing(raw: Parameters<typeof sourceHash>[0]): Promise<MetroRouteResult> {
  try {
    const hash = sourceHash(raw); const cached = await getCachedMetroRoute(raw.listingId, hash);
    if (cached) return { route: cached };
    const config = await getRouteApiConfig();
    const locationQuery = raw.title?.replace(/^piso\s+en\s+/i, "").trim();
    if (!locationQuery || !config.openRouteServiceApiKey) return { route: null, error: "Falta la clave de OpenRouteService" };
    const route = await calculateMetroRoute(locationQuery, config);
    if (route) await saveCachedMetroRoute(raw.listingId, hash, route);
    return route ? { route } : { route: null, error: "No se encontró una estación cercana" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.warn("Metro route enrichment failed", message);
    return { route: null, error: message };
  }
}

const MAX_CONCURRENT_METRO_ROUTES = 2;
let activeMetroRoutes = 0;
const waitingMetroRoutes: Array<() => void> = [];

async function acquireMetroRouteSlot(): Promise<void> {
  if (activeMetroRoutes < MAX_CONCURRENT_METRO_ROUTES) { activeMetroRoutes += 1; return; }
  await new Promise<void>(resolve => waitingMetroRoutes.push(resolve));
  activeMetroRoutes += 1;
}

function releaseMetroRouteSlot(): void {
  activeMetroRoutes -= 1;
  waitingMetroRoutes.shift()?.();
}

async function enqueueMetroRoute(raw: Parameters<typeof sourceHash>[0]) {
  await acquireMetroRouteSlot();
  try { return await metroRouteForListing(raw); } finally { releaseMetroRouteSlot(); }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void (async () => {
    if (message.type === "GET_PREFERENCES") return sendResponse(await getPreferences());
    if (message.type === "SAVE_PREFERENCES") { await savePreferences(message.payload); return sendResponse({ ok: true }); }
    if (message.type === "GET_ROUTE_API_CONFIG") return sendResponse(await getRouteApiConfig());
    if (message.type === "SAVE_ROUTE_API_CONFIG") { await saveRouteApiConfig(message.payload); return sendResponse({ ok: true }); }
    if (message.type === "GET_METRO_ROUTE") return sendResponse(await enqueueMetroRoute(message.payload));
    const hash = sourceHash(message.payload); const cached = await getCachedListing(message.payload.listingId, hash);
    if (cached) return sendResponse({ property: cached.normalized, score: cached.score } satisfies EnrichedPropertyResponse);
    const property = normalizeListing(message.payload); const score = scoreProperty(property, await getPreferences());
    await saveCachedListing({ listingId: property.listingId, sourceHash: hash, raw: message.payload, normalized: property, score, cachedAt: new Date().toISOString(), schemaVersion: 5 }); sendResponse({ property, score } satisfies EnrichedPropertyResponse);
  })().catch(error => { console.warn("Idealista Personal Score error", error instanceof Error ? error.message : "unknown"); sendResponse({ error: "Could not score this listing." }); });
  return true;
});
