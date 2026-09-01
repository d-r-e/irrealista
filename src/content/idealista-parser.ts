import type { Feature, IdealistaListingRaw, PropertyFeatures } from "../schemas/property";
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, " ").trim() || undefined;
export const parseSpanishNumber = (value?: string): number | undefined => { if (!value) return undefined; const result = Number(value.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(result) ? result : undefined; };
export function parseListingCard(card: Element): IdealistaListingRaw | null {
  const anchor = card.querySelector<HTMLAnchorElement>('a[href*="/inmueble/"]'); const href = anchor?.href; const listingId = href?.match(/\/(\d+)(?:\/|$|\?)/)?.[1] || card.getAttribute("data-element-id") || card.getAttribute("data-adid");
  if (!href || !listingId) return null;
  const allText = text(card) || ""; const features = [...card.querySelectorAll("li, [class*=item-detail], [data-testid]")].map(text).filter((v): v is string => Boolean(v));
  const priceText = text(card.querySelector(".item-price")) || allText.match(/(?:^|[^\d])([\d.]+)\s*€(?!\s*\/\s*m²)/u)?.[1];
  const areaText = features.find(item => /\d[\d.,]*\s*m²/i.test(item)) || allText.match(/\d[\d.,]*\s*m²/i)?.[0];
  const pricePerM2Text = allText.match(/[\d.]+\s*€\s*\/\s*m²/i)?.[0]; const floorText = features.find(item => /planta|bajo|ático/i.test(item));
  return { listingId, url: href, title: text(card.querySelector("a.item-link, [class*=item-link]")), description: text(card.querySelector(".item-description, [class*=description]")), price: parseSpanishNumber(priceText), areaM2: parseSpanishNumber(areaText), pricePerM2: parseSpanishNumber(pricePerM2Text), floorText, elevator: /con ascensor/i.test(allText) ? true : /sin ascensor/i.test(allText) ? false : undefined, exterior: /\bexterior\b/i.test(allText) ? true : /\binterior\b/i.test(allText) ? false : undefined, rawFeatureTexts: features, renovationSearch: window.location.pathname.includes("para-reformar") };
}
export function normalizeListing(raw: IdealistaListingRaw): PropertyFeatures {
  const source = raw.detailText ? "idealista_text" as const : "idealista_dom" as const;
  const detail = [raw.description, raw.detailText, ...raw.rawFeatureTexts].filter(Boolean).join(" ");
  const floorText = raw.floorText ?? detail;
  const floorMatch = floorText.match(/(\d+)\s*(?:ª|a)?\s*planta/i);
  const floor = /semi[-\s]?sótano/i.test(floorText) ? -1 : /\bsótano\b/i.test(floorText) ? -2 : /entreplanta/i.test(floorText) ? -0.5 : /\bbajo\b|planta baja/i.test(floorText) ? 0 : floorMatch ? Number(floorMatch[1]) : null;
  const feature = <T>(value: T | null, confidence = value === null ? 0 : 1): Feature<T> => ({ value, source, confidence });
  const extractNumber = (pattern: RegExp): number | null => parseSpanishNumber(detail.match(pattern)?.[1]) ?? null;
  const yearBuilt = extractNumber(/Construido en\s+((?:18|19|20)\d{2})/i);
  const usableAreaM2 = extractNumber(/([\d.,]+)\s*m²\s*útiles/i);
  const usableAreaRatio = usableAreaM2 && raw.areaM2 ? usableAreaM2 / raw.areaM2 : null;
  const energyRaw = extractNumber(/Consumo:\s*([\d.,]+)\s*kWh\s*\/\s*m²\s*año/i);
  const energyConsumption = energyRaw && energyRaw >= 10 ? energyRaw : null;
  const heatingQuality = /no dispone de calefacción|sin calefacción/i.test(detail) ? 15 : /calefacción central/i.test(detail) ? 100 : /gas natural/i.test(detail) ? 95 : /bomba de frío\s*\/\s*calor/i.test(detail) ? 70 : /calefacción individual/i.test(detail) ? 75 : null;
  const needsRenovation = /segunda mano\s*\/\s*para reformar|\b(?:íntegramente\s+)?a reformar\b|reforma integral necesaria/i.test(detail) ? true : /segunda mano\s*\/\s*buen estado|reformad[oa]\s+(?:integralmente|recientemente)|a estrenar/i.test(detail) ? false : null;
  const detailKnown = Boolean(raw.detailText);
  const knownBoolean = (pattern: RegExp): boolean | null => pattern.test(detail) ? true : detailKnown ? false : null;
  const hasOutdoorSpace = knownBoolean(/\bterraza\b|\bbalcón\b|patio de uso privativo|\bjardín\b/i);
  const hasStorage = knownBoolean(/\btrastero\b/i);
  const hasAirConditioning = knownBoolean(/aire acondicionado/i);
  const streetLevelAccess = knownBoolean(/a pie de calle|acceso directo desde la calle/i);
  const isNonResidential = knownBoolean(/registrad[oa] como local|registralmente[^.]{0,100}(?:figura|consta) como local|(?:figura|consta) registralmente como local|cambio de uso(?:\s+a residencial)?/i);
  const hasTenant = knownBoolean(/actualmente alquilad[oa]|se vende alquilad[oa]|con inquilin[oa]|inmueble sin posesión|sin posesión del inmueble/i);
  const isAuctionOrCashOnly = knownBoolean(/\b(?:proceso de )?subasta\b|subasta judicial|cesión de remate|adjudicación judicial|no se puede financiar con (?:una )?hipoteca|no hipotecable|no admite financiación hipotecaria|(?:es )?necesario contar con liquidez|solo (?:pago al contado|compradores? con fondos propios)/i);
  const lacksHabitabilityCertificate = knownBoolean(/\bsin (?:c[eé]dula|licencia)(?: de habitabilidad)?\b|(?:no (?:dispone|cuenta) con|carece de) (?:c[eé]dula|licencia) de habitabilidad/i);
  const hasNonStandardBedroom = knownBoolean(/terraza[^.]{0,100}(?:hacer|convertid)[^.]{0,80}habitaci|altillo[^.]{0,100}(?:cama|dormitorio|descanso)|módulo elevado|escaleras de bruja/i);
  const orientationText = detail.match(/Orientación\s+([^\n.]+)/i)?.[1]?.toLowerCase();
  const orientationQuality = orientationText ? /sur|este/.test(orientationText) ? 100 : /oeste/.test(orientationText) ? 75 : /norte/.test(orientationText) ? 35 : null : null;
  return { listingId: raw.listingId, url: raw.url, price: feature(raw.price ?? null), areaM2: feature(raw.areaM2 ?? null), pricePerM2: feature(raw.pricePerM2 ?? (raw.price && raw.areaM2 ? Math.round(raw.price / raw.areaM2) : null)), floor: feature(floor), isGroundFloor: feature(floor === null ? null : floor === 0), elevator: feature(raw.elevator ?? null), exterior: feature(raw.exterior ?? null), yearBuilt: feature(yearBuilt), usableAreaM2: feature(usableAreaM2), usableAreaRatio: feature(usableAreaRatio), energyConsumption: feature(energyConsumption), heatingQuality: feature(heatingQuality), needsRenovation: feature(needsRenovation), orientationQuality: feature(orientationQuality), hasOutdoorSpace: feature(hasOutdoorSpace), hasStorage: feature(hasStorage), hasAirConditioning: feature(hasAirConditioning), streetLevelAccess: feature(streetLevelAccess), isNonResidential: feature(isNonResidential), hasTenant: feature(hasTenant), isAuctionOrCashOnly: feature(isAuctionOrCashOnly), lacksHabitabilityCertificate: feature(lacksHabitabilityCertificate), hasNonStandardBedroom: feature(hasNonStandardBedroom), renovationSearch: Boolean(raw.renovationSearch) };
}
