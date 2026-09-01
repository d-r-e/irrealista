import { parseListingCard } from "./idealista-parser";
import { enrichFromDetail } from "./detail-enrichment";
import { renderMetroStatus, renderScore } from "./renderer";
import { injectSorter } from "./sorter";
import type { EnrichedPropertyResponse, ExtensionMessage } from "../shared/messages";
const CARD_SELECTORS = "article[data-element-id], article.item";
async function processCard(card: Element): Promise<void> {
  if (card.hasAttribute("data-ips-processed")) return;
  card.setAttribute("data-ips-processed", "true");
  const raw = parseListingCard(card);
  if (!raw) return;
  try {
    const response = await chrome.runtime.sendMessage<ExtensionMessage, EnrichedPropertyResponse>({ type: "ENRICH_PROPERTY", payload: raw });
    if (!response?.score) { card.removeAttribute("data-ips-processed"); return; }
    let score = response.score;
    let metroRoute: import("../shared/metro").MetroRoute | null | undefined;
    const render = () => renderScore(card, score, metroRoute);
    render();
    renderMetroStatus(card, "pending");
    void enrichFromDetail(raw).then(async enrichedRaw => {
      if (!card.isConnected || !enrichedRaw.detailText) return;
      const enriched = await chrome.runtime.sendMessage<ExtensionMessage, EnrichedPropertyResponse>({ type: "ENRICH_PROPERTY", payload: enrichedRaw });
      if (card.isConnected && enriched?.score) { score = enriched.score; render(); }
    }).catch(() => undefined);
    void chrome.runtime.sendMessage<ExtensionMessage, import("../shared/metro").MetroRouteResult>({ type: "GET_METRO_ROUTE", payload: raw }).then(result => {
      if (!card.isConnected) return;
      if (result?.route) { metroRoute = result.route; render(); }
      else renderMetroStatus(card, "unavailable", result?.error);
    }).catch(() => { if (card.isConnected) renderMetroStatus(card, "unavailable", "La extensión no pudo responder"); });
  } catch { card.removeAttribute("data-ips-processed"); }
}
function scan(): void { const cards = [...document.querySelectorAll(CARD_SELECTORS)]; cards.forEach(card => void processCard(card)); const parent = cards[0]?.parentElement; if (parent) injectSorter(parent); }
scan(); new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
