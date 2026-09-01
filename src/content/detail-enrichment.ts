import type { IdealistaListingRaw } from "../schemas/property";

interface CachedDetail { text: string; fetchedAt: number; }

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1400;
const cacheKey = (listingId: string) => `idealista-detail:${listingId}`;
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function compact(value: string): string { return value.replace(/\s+/g, " ").trim(); }

function extractRelevantText(html: string): string | null {
  const document = new DOMParser().parseFromString(html, "text/html");
  const mainText = compact(document.querySelector("main")?.textContent ?? "");
  if (!mainText.includes("Características básicas")) return null;
  const description = mainText.match(/Comentario del anunciante([\s\S]*?)(?=Características básicas)/i)?.[0] ?? "";
  const features = mainText.match(/Características básicas([\s\S]*?)(?=Anuncio actualizado|Precio del inmueble|Ubicación|Estadísticas|Referencia del anuncio)/i)?.[0] ?? "";
  return compact(`${description} ${features}`) || null;
}

export async function enrichFromDetail(raw: IdealistaListingRaw): Promise<IdealistaListingRaw> {
  const stored = await chrome.storage.local.get(cacheKey(raw.listingId));
  const cached = stored[cacheKey(raw.listingId)] as CachedDetail | undefined;
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return { ...raw, detailText: cached.text };
  const task = queue.then(async () => {
    const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    const response = await fetch(raw.url, { credentials: "include" });
    lastRequestAt = Date.now();
    if (!response.ok) return null;
    const detailText = extractRelevantText(await response.text());
    if (!detailText) return null;
    await chrome.storage.local.set({ [cacheKey(raw.listingId)]: { text: detailText, fetchedAt: Date.now() } satisfies CachedDetail });
    return detailText;
  });
  queue = task.catch(() => undefined);
  const detailText = await task.catch(() => null);
  return detailText ? { ...raw, detailText } : raw;
}
