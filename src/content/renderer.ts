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

function formatPoints(value: number): string {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

function formatSignedPoints(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatPoints(Math.abs(value))}`;
}

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
  button.innerHTML = score.passed && score.score !== null ? `<span class="ips-score-label">Tu score</span><strong class="ips-score-number"><span>${score.score}</span><small>/100</small></strong><span class="ips-disclosure">Ver detalle</span>` : `<span class="ips-score-label">Tu score</span><strong class="ips-no-match">No cumple tus filtros</strong><span class="ips-disclosure">Ver detalle</span>`;
  const details = document.createElement("div");
  details.className = "ips-details";
  const totalWeight = score.contributions.reduce((sum, contribution) => sum + contribution.weight, 0);
  const totalPoints = totalWeight ? score.contributions.reduce((sum, contribution) => sum + contribution.weightedContribution / totalWeight, 0) : 0;
  const list = score.contributions.map(contribution => {
    const contributionPoints = totalWeight ? contribution.weightedContribution / totalWeight : 0;
    const maxPoints = totalWeight ? 100 * contribution.weight / totalWeight : 0;
    const utility = Math.max(0, Math.min(100, contribution.utility));
    const utilityClass = utility < 40 ? "is-low" : utility < 70 ? "is-medium" : "is-high";
    return `<li class="ips-factor ${utilityClass}">
      <div class="ips-factor-name"><strong>${escapeHtml(criterionLabels[contribution.criterion] ?? contribution.criterion)}</strong><span>${escapeHtml(String(contribution.rawValue))}</span></div>
      <strong class="ips-factor-points${contributionPoints < 0 ? " is-negative" : ""}">${formatSignedPoints(contributionPoints)} pts</strong>
      <span class="ips-factor-bar" aria-label="Valoración ${Math.round(utility)} de 100"><i style="--ips-factor-utility:${utility.toFixed(2)}%"></i></span>
      <div class="ips-factor-meta"><span class="ips-factor-weight">Peso ${contribution.weight} · máx. ${formatPoints(maxPoints)} pts</span><em>${Math.round(contribution.confidence * 100)}% de confianza · ${escapeHtml(contribution.source)}</em></div>
    </li>`;
  }).join("");
  const metro = metroRoute ? `<p class="ips-metro"><span class="ips-metro-mark" aria-hidden="true"></span>${metroLineBadges(metroRoute.lines)}<strong>${escapeHtml(metroRoute.stationName)}</strong><span>${Math.round(metroRoute.distanceMeters)} m · ${Math.round(metroRoute.durationSeconds / 60)} min a pie</span></p>` : "";
  const failures = score.failedFilters.map(id => failureLabels[id] ?? id).map(escapeHtml).join(", ");
  details.innerHTML = `<div class="ips-details-heading"><strong>Desglose del score</strong><span>${score.contributions.length} factores</span></div><ul class="ips-factor-list">${list || "<li>No hay criterios con datos.</li>"}</ul><div class="ips-details-total"><span>Suma de factores</span><strong>${formatPoints(totalPoints)} pts</strong><small>Score final <b>${score.score ?? "—"}/100</b></small></div>${metro}${failures ? `<p class="ips-details-alert">Alerta: ${failures}</p>` : ""}`;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const open = details.classList.toggle("is-open");
    host.classList.toggle("ips-score-details-open", open);
    button.setAttribute("aria-expanded", String(open));
  });
  holder.append(button, details);
  host.prepend(holder);
  card.setAttribute("data-ips-score", String(score.score ?? -1));
  card.setAttribute("data-ips-price", String(score.contributions.find(c => c.criterion === "price")?.rawValue ?? Number.MAX_SAFE_INTEGER));
  card.setAttribute("data-ips-area", String(score.contributions.find(c => c.criterion === "areaM2")?.rawValue ?? -1));
}
