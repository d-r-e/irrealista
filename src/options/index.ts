import type { BooleanField, NumericField, UserPreferences } from "../schemas/preferences";
import type { RouteApiConfig } from "../shared/config";

const form = document.querySelector<HTMLFormElement>("#preferences-form")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;

interface AxisTick { value: number; label: string; }
interface NumericInfo { label: string; description: string; unit?: string; min: number; max: number; step: number; ticks?: AxisTick[]; }
const numericInfo: Record<NumericField, NumericInfo> = {
  price: { label: "Precio", description: "Favorece los importes bajos dentro de tu rango.", unit: "€", min: 0, max: 500000, step: 5000 }, areaM2: { label: "Superficie", description: "Premia tener más metros construidos.", unit: "m²", min: 0, max: 150, step: 1 }, pricePerM2: { label: "€/m²", description: "El indicador económico principal: cuanto menor, mejor.", unit: "€/m²", min: 0, max: 12000, step: 100 },
  floor: { label: "Planta", description: "La altura suma; sótano y semisótano restan de forma explícita.", min: -2, max: 12, step: 0.5, ticks: [{ value: -2, label: "Sótano" }, { value: -1, label: "Semisótano" }, { value: -0.5, label: "Entreplanta" }, { value: 0, label: "Baja" }, ...Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1}ª` }))] },
  yearBuilt: { label: "Año del edificio", description: "Los edificios más recientes puntúan mejor.", unit: "año", min: 1850, max: 2030, step: 5 }, usableAreaRatio: { label: "Aprovechamiento útil", description: "Relación entre metros útiles y construidos.", min: 0.3, max: 1, step: 0.01 }, energyConsumption: { label: "Consumo energético", description: "Menos consumo estimado, mejor.", unit: "kWh/m² año", min: 0, max: 600, step: 10 },
  heatingQuality: { label: "Calefacción", description: "Valora la calidad y tipo de calefacción anunciado.", min: 0, max: 100, step: 5, ticks: [{ value: 0, label: "Desconocida" }, { value: 15, label: "Sin calefacción" }, { value: 70, label: "Bomba frío/calor" }, { value: 75, label: "Individual" }, { value: 95, label: "Gas natural" }, { value: 100, label: "Central" }] },
  orientationQuality: { label: "Orientación", description: "Sur y este por delante de oeste y norte.", min: 0, max: 100, step: 5, ticks: [{ value: 0, label: "Desconocida" }, { value: 35, label: "Norte" }, { value: 75, label: "Oeste" }, { value: 100, label: "Sur / Este" }] }
};
const booleanInfo: Record<BooleanField, { label: string; description: string; trueLabel: string; falseLabel: string }> = {
  elevator: { label: "Ascensor", description: "Se combina con la planta; sus reglas se ajustan abajo.", trueLabel: "Con ascensor", falseLabel: "Sin ascensor" }, exterior: { label: "Exterior", description: "Prioriza vivienda exterior frente a interior.", trueLabel: "Exterior", falseLabel: "Interior" }, needsRenovation: { label: "Reforma", description: "Penaliza ‘para reformar’ y ‘para actualizar’.", trueLabel: "Necesita reforma", falseLabel: "Buen estado" }, hasOutdoorSpace: { label: "Espacio exterior", description: "Terraza, balcón, patio privado o jardín.", trueLabel: "Tiene", falseLabel: "No consta" }, hasStorage: { label: "Trastero", description: "Da un pequeño extra al trastero.", trueLabel: "Tiene", falseLabel: "No consta" }, hasAirConditioning: { label: "Aire acondicionado", description: "Da un pequeño extra si consta en el anuncio.", trueLabel: "Tiene", falseLabel: "No consta" }, streetLevelAccess: { label: "A pie de calle", description: "Penaliza posible local o vivienda con acceso directo desde la calle.", trueLabel: "A pie de calle", falseLabel: "No consta" }, hasNonStandardBedroom: { label: "Dormitorio no convencional", description: "Penaliza altillos, módulos o espacios presentados como dormitorio.", trueLabel: "Detectado", falseLabel: "No consta" }
};

function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!); }
function numberInput(name: string, value: number, options = ""): string { return `<input type="number" name="${name}" value="${value}" ${options}>`; }
function rangeAxis(info: NumericInfo): string {
  if (!info.ticks) return `<div class="range-scale"><span>${info.min}${info.unit ? ` ${info.unit}` : ""}</span><span>${info.max}${info.unit ? ` ${info.unit}` : ""}</span></div>`;
  const ticks = info.ticks.map(tick => { const position = 100 * (tick.value - info.min) / (info.max - info.min); return `<span class="range-axis-tick" style="--tick-position:${position}%"><i></i><b>${tick.label}</b></span>`; }).join("");
  return `<div class="range-axis" aria-hidden="true">${ticks}</div>`;
}
function numericCard(field: NumericField, preferences: UserPreferences): string {
  const criterion = preferences.numeric[field]; const info = numericInfo[field]; const lowerIsBetter = criterion.zones.direction === "lower-is-better"; const positiveLabel = lowerIsBetter ? "Positivo hasta" : "Positivo desde"; const negativeLabel = lowerIsBetter ? "Negativo desde" : "Negativo por debajo de";
  const legend = lowerIsBetter ? `<span class="zone-positive">Positivo</span><span class="zone-neutral">Neutro</span><span class="zone-negative">Negativo</span>` : `<span class="zone-negative">Negativo</span><span class="zone-neutral">Neutro</span><span class="zone-positive">Positivo</span>`;
  return `<article class="criterion-card"><div class="criterion-heading"><div><h3>${info.label}</h3><p>${info.description}</p></div><label class="switch"><input type="checkbox" name="enabled:${field}" ${criterion.enabled ? "checked" : ""}> Usar</label></div><div class="criterion-controls"><label class="weight-input">Peso${numberInput(`weight:${field}`, criterion.weight, "min=0 max=30 step=1")}</label><span class="direction-badge">${lowerIsBetter ? "↓ Menos es mejor" : "↑ Más es mejor"}</span></div><div class="zone-legend">${legend}</div><div class="dual-range" data-direction="${criterion.zones.direction}"><span class="range-track" aria-hidden="true"></span><input aria-label="${positiveLabel}" type="range" name="zone:${field}:positive" min="${info.min}" max="${info.max}" step="${info.step}" value="${criterion.zones.positiveBoundary}"><input aria-label="${negativeLabel}" type="range" name="zone:${field}:negative" min="${info.min}" max="${info.max}" step="${info.step}" value="${criterion.zones.negativeBoundary}"></div>${rangeAxis(info)}<div class="zone-values"><label><span class="value-dot value-dot--positive"></span>${positiveLabel}${numberInput(`zone-number:${field}:positive`, criterion.zones.positiveBoundary, `min=${info.min} max=${info.max} step=${info.step}`)}</label><label><span class="value-dot value-dot--negative"></span>${negativeLabel}${numberInput(`zone-number:${field}:negative`, criterion.zones.negativeBoundary, `min=${info.min} max=${info.max} step=${info.step}`)}</label></div></article>`;
}
function booleanCard(field: BooleanField, preferences: UserPreferences): string {
  const criterion = preferences.boolean[field]; const info = booleanInfo[field]; const values = field === "elevator" ? "" : `<div class="boolean-values"><label>${info.trueLabel}${numberInput(`value:${field}:true`, criterion.values.true, "min=-100 max=100 step=1")}</label><label>${info.falseLabel}${numberInput(`value:${field}:false`, criterion.values.false, "min=-100 max=100 step=1")}</label></div>`;
  return `<article class="criterion-card"><div class="criterion-heading"><div><h3>${info.label}</h3><p>${info.description}</p></div><label class="switch"><input type="checkbox" name="enabled:${field}" ${criterion.enabled ? "checked" : ""}> Usar</label></div><label class="weight-input">Peso${numberInput(`weight:${field}`, criterion.weight, "min=0 max=30 step=1")}</label>${values}</article>`;
}
function floorAccessInputs(preferences: UserPreferences): string {
  const settings = preferences.floorAccess; const fields: Array<[keyof typeof settings, string, string]> = [["groundFloor", "Planta baja", "Con o sin ascensor"], ["aboveGroundWithElevator", "Planta ≥ 1 con ascensor", "La situación preferida"], ["highFloorWithElevator", "Planta ≥ 5 con ascensor", "Pequeño ajuste por altura"], ["firstFloorWithoutElevator", "1ª sin ascensor", "Penalización ligera"], ["secondFloorWithoutElevator", "2ª sin ascensor", "Penalización media"], ["thirdFloorWithoutElevator", "3ª sin ascensor", "Penalización alta"], ["fourthFloorOrHigherWithoutElevator", "≥ 4ª sin ascensor", "La peor situación"]];
  return fields.map(([key, label, hint]) => `<label class="access-setting"><span>${label}<small>${hint}</small></span>${numberInput(`access:${key}`, settings[key], "min=-100 max=100 step=1")}</label>`).join("");
}
async function loadPreferences(): Promise<UserPreferences> { return chrome.runtime.sendMessage({ type: "GET_PREFERENCES" }); }
async function loadRouteApiConfig(): Promise<RouteApiConfig> { return chrome.runtime.sendMessage({ type: "GET_ROUTE_API_CONFIG" }); }
function setNumber(data: FormData, name: string, fallback: number): number { const value = Number(data.get(name)); return Number.isFinite(value) ? value : fallback; }
function setupDualRanges(): void {
  document.querySelectorAll<HTMLElement>(".dual-range").forEach(container => {
    const [positive, negative] = [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')];
    const [positiveNumber, negativeNumber] = [...container.parentElement!.querySelectorAll<HTMLInputElement>(".zone-values input")];
    const direction = container.dataset.direction;
    const paint = () => {
      const min = Number(positive.min); const max = Number(positive.max); const positiveValue = Number(positive.value); const negativeValue = Number(negative.value);
      const positivePercent = 100 * (positiveValue - min) / (max - min); const negativePercent = 100 * (negativeValue - min) / (max - min);
      container.style.setProperty("--positive-boundary", `${positivePercent}%`); container.style.setProperty("--negative-boundary", `${negativePercent}%`);
      container.classList.toggle("is-lower-better", direction === "lower-is-better"); positiveNumber.value = positive.value; negativeNumber.value = negative.value;
    };
    const constrain = (changed: HTMLInputElement) => {
      if (direction === "lower-is-better" && Number(positive.value) > Number(negative.value)) changed === positive ? negative.value = positive.value : positive.value = negative.value;
      if (direction === "higher-is-better" && Number(negative.value) > Number(positive.value)) changed === positive ? negative.value = positive.value : positive.value = negative.value;
      paint();
    };
    positive.addEventListener("input", () => constrain(positive)); negative.addEventListener("input", () => constrain(negative));
    positiveNumber.addEventListener("input", () => { positive.value = positiveNumber.value; constrain(positive); }); negativeNumber.addEventListener("input", () => { negative.value = negativeNumber.value; constrain(negative); }); paint();
  });
}

async function init(): Promise<void> {
  const [preferences, routes] = await Promise.all([loadPreferences(), loadRouteApiConfig()]);
  form.innerHTML = `<section><h2>Cómo se calcula tu score</h2><p>Activa los criterios que te importen y asigna más peso a los decisivos. Cada doble control delimita las zonas roja (resta), neutra y verde (suma).</p><div class="criteria-grid">${(Object.keys(numericInfo) as NumericField[]).map(field => numericCard(field, preferences)).join("")}</div></section><section><h2>Características del anuncio</h2><p>El valor indica la puntuación de cada estado, de −100 a 100. Los valores negativos restan al score.</p><div class="criteria-grid">${(Object.keys(booleanInfo) as BooleanField[]).map(field => booleanCard(field, preferences)).join("")}</div></section><section><h2>Planta y ascensor</h2><p>El ascensor se puntúa únicamente junto con la planta. Sótano y semisótano quedan en la zona roja de <em>Planta</em>, mientras que planta baja permanece neutra.</p><div class="access-grid">${floorAccessInputs(preferences)}</div></section><section><h2>Filtros excluyentes</h2><p>Al activarlos, una vivienda que no cumpla se marca como descartada, aunque conserve su desglose.</p><div class="filter-grid">${preferences.hardFilters.map((filter, index) => `<label class="filter-setting"><span><input type="checkbox" name="filter:${index}:enabled" ${filter.enabled ? "checked" : ""}> ${filter.id === "max-price" ? "Precio máximo" : "Superficie mínima"}</span>${numberInput(`filter:${index}:value`, filter.value, "min=0 step=1")}</label>`).join("")}</div></section><section class="routes-panel"><div><h2>Rutas a pie al Metro de Madrid</h2><p>OpenRouteService calcula el recorrido a pie; los resultados se cachean por anuncio.</p></div><label>URL de OpenStreetMap Nominatim<input type="url" name="nominatimBaseUrl" value="${escapeHtml(routes.nominatimBaseUrl)}"></label><label>URL de OpenRouteService<input type="url" name="openRouteServiceBaseUrl" value="${escapeHtml(routes.openRouteServiceBaseUrl)}"></label><label>Clave de OpenRouteService<input type="password" name="openRouteServiceApiKey" placeholder="Pega tu clave de ORS" value="${escapeHtml(routes.openRouteServiceApiKey)}" autocomplete="off"></label></section>`;
  setupDualRanges();
  document.querySelector("#save")!.addEventListener("click", async () => {
    const data = new FormData(form);
    for (const field of Object.keys(numericInfo) as NumericField[]) { const criterion = preferences.numeric[field]; criterion.enabled = data.has(`enabled:${field}`); criterion.weight = setNumber(data, `weight:${field}`, criterion.weight); criterion.zones.positiveBoundary = setNumber(data, `zone-number:${field}:positive`, criterion.zones.positiveBoundary); criterion.zones.negativeBoundary = setNumber(data, `zone-number:${field}:negative`, criterion.zones.negativeBoundary); }
    for (const field of Object.keys(booleanInfo) as BooleanField[]) { const criterion = preferences.boolean[field]; criterion.enabled = data.has(`enabled:${field}`); criterion.weight = setNumber(data, `weight:${field}`, criterion.weight); if (field !== "elevator") { criterion.values.true = setNumber(data, `value:${field}:true`, criterion.values.true); criterion.values.false = setNumber(data, `value:${field}:false`, criterion.values.false); } }
    for (const key of Object.keys(preferences.floorAccess) as Array<keyof typeof preferences.floorAccess>) preferences.floorAccess[key] = setNumber(data, `access:${key}`, preferences.floorAccess[key]);
    preferences.hardFilters.forEach((filter, index) => { filter.enabled = data.has(`filter:${index}:enabled`); filter.value = setNumber(data, `filter:${index}:value`, filter.value); });
    const routeConfig: RouteApiConfig = { nominatimBaseUrl: String(data.get("nominatimBaseUrl") ?? "").trim().replace(/\/$/, ""), openRouteServiceBaseUrl: String(data.get("openRouteServiceBaseUrl") ?? "").trim().replace(/\/$/, ""), openRouteServiceApiKey: String(data.get("openRouteServiceApiKey") ?? "").trim() };
    await Promise.all([chrome.runtime.sendMessage({ type: "SAVE_PREFERENCES", payload: preferences }), chrome.runtime.sendMessage({ type: "SAVE_ROUTE_API_CONFIG", payload: routeConfig })]); status.value = "Preferencias guardadas. Recarga la página de Idealista para recalcular los anuncios.";
  });
}
void init();
