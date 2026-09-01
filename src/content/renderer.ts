import type { PropertyScore } from "../scoring/engine";
import type { MetroLine, MetroRoute } from "../shared/metro";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

const criterionLabels: Record<string, string> = {
  price: "Precio", areaM2: "Superficie", pricePerM2: "€/m²", floor: "Altura de planta", elevator: "Ascensor", floorElevatorAccess: "Acceso planta–ascensor", exterior: "Exterior",
  yearBuilt: "Año del edificio", usableAreaRatio: "Aprovechamiento útil", energyConsumption: "Consumo energético", heatingQuality: "Calefacción",
  orientationQuality: "Orientación", needsRenovation: "Estado / reforma", hasOutdoorSpace: "Espacio exterior", hasStorage: "Trastero",
  hasAirConditioning: "Aire acondicionado", streetLevelAccess: "A pie de calle", hasNonStandardBedroom: "Dormitorio no convencional"
};
const failureLabels: Record<string, string> = { "non-residential": "Posible uso no residencial / cambio de uso", "occupied-or-rented": "Actualmente alquilado, ocupado o sin posesión", "auction-or-cash-only": "Subasta o compra no financiable con hipoteca", "no-habitability-certificate": "Sin cédula o licencia de habitabilidad" };

function metroLineBadges(lines: MetroLine[]): string {
  return `<span class="ips-metro-lines">${lines.map(line => `<span class="ips-metro-line" aria-label="Línea ${escapeHtml(line.shortName)}" title="Línea ${escapeHtml(line.shortName)}" style="--ips-line-color:${safeColor(line.color, "#005aa9")};--ips-line-text:${safeColor(line.textColor, "#ffffff")}">${escapeHtml(line.shortName)}</span>`).join("")}</span>`;
}

function renderMetroFooter(card: Element, text: string, state: "ready" | "pending" | "unavailable"): void {
  const info = card.querySelector(".item-info-container");
  if (!info) return;
  info.querySelector(".ips-metro-footer")?.remove();
  info.classList.add("ips-has-metro");
  const metroFooter = document.createElement("div");
  metroFooter.className = `ips-metro-footer ips-metro-footer--${state}`;
  metroFooter.textContent = text;
  const toolbar = info.querySelector(".item-toolbar");
  if (toolbar) toolbar.before(metroFooter); else info.append(metroFooter);
}

function renderMetroRouteFooter(card: Element, route: MetroRoute): void {
  const info = card.querySelector(".item-info-container");
  if (!info) return;
  info.querySelector(".ips-metro-footer")?.remove();
  info.classList.add("ips-has-metro");
  const footer = document.createElement("div");
  footer.className = "ips-metro-footer ips-metro-footer--ready";
  footer.innerHTML = `<span class="ips-metro-mark" aria-hidden="true"></span>${metroLineBadges(route.lines)}<strong class="ips-metro-station">${escapeHtml(route.stationName)}</strong><span class="ips-metro-walk">≈ ${Math.max(1, Math.round(route.durationSeconds / 60))} min andando</span><span class="ips-metro-distance">${Math.round(route.distanceMeters)} m</span>`;
  const toolbar = info.querySelector(".item-toolbar");
  if (toolbar) toolbar.before(footer); else info.append(footer);
}

export function renderMetroStatus(card: Element, state: "pending" | "unavailable", detail?: string): void {
  renderMetroFooter(card, state === "pending" ? "Metro · Calculando ruta a pie…" : `Metro · ${detail || "Ruta no disponible"}`, state);
}

export function renderScore(card: Element, score: PropertyScore, metroRoute?: MetroRoute | null): void {
  const host = card;
  host.classList.add("ips-score-host");
  card.querySelector(".ips-badge")?.remove(); const holder = document.createElement("div"); holder.className = `ips-badge${score.passed ? "" : " ips-failed"}`;
  const info = card.querySelector(".item-info-container");
  info?.querySelector(".ips-metro-footer")?.remove();
  info?.classList.toggle("ips-has-metro", Boolean(metroRoute));
  if (metroRoute) renderMetroRouteFooter(card, metroRoute);
  const button = document.createElement("button"); button.className = "ips-score-button"; button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = score.passed && score.score !== null ? `<span class="ips-score-label">Tu score</span><strong class="ips-score-number"><span>${score.score}</span><small>/100</small></strong><span class="ips-confidence">Confianza ${score.dataConfidence}%</span><span class="ips-disclosure">Ver detalle</span>` : `<span class="ips-score-label">Tu score</span><strong class="ips-no-match">No cumple tus filtros</strong><span class="ips-confidence">Confianza ${score.dataConfidence}%</span><span class="ips-disclosure">Ver detalle</span>`;
  const details = document.createElement("div"); details.className = "ips-details"; const list = score.contributions.map(c => `<li><strong>${escapeHtml(criterionLabels[c.criterion] ?? c.criterion)}</strong>: ${escapeHtml(String(c.rawValue))} · ${Math.round(c.utility)} pts · peso ${c.weight} <em>(${escapeHtml(c.source)})</em></li>`).join(""); const metro = metroRoute ? `<p class="ips-metro"><span class="ips-metro-mark" aria-hidden="true"></span>${metroLineBadges(metroRoute.lines)}<strong>${escapeHtml(metroRoute.stationName)}</strong><span>${Math.round(metroRoute.distanceMeters)} m · ${Math.round(metroRoute.durationSeconds / 60)} min a pie</span></p>` : ""; const failures = score.failedFilters.map(id => failureLabels[id] ?? id).map(escapeHtml).join(", "); details.innerHTML = `<strong>Desglose del score</strong><ul>${list || "<li>No hay criterios con datos.</li>"}</ul>${metro}${failures ? `<p>Alerta: ${failures}</p>` : ""}`;
  button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); const open = details.classList.toggle("is-open"); button.setAttribute("aria-expanded", String(open)); }); holder.append(button, details); host.prepend(holder); card.setAttribute("data-ips-score", String(score.score ?? -1)); card.setAttribute("data-ips-price", String(score.contributions.find(c => c.criterion === "price")?.rawValue ?? Number.MAX_SAFE_INTEGER)); card.setAttribute("data-ips-area", String(score.contributions.find(c => c.criterion === "areaM2")?.rawValue ?? -1));
}
