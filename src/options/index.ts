import type { UserPreferences } from "../schemas/preferences";
import type { RouteApiConfig } from "../shared/config";

const form = document.querySelector<HTMLFormElement>("#preferences-form")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;

function field(name: string, value: number, label: string): string {
  return `<label>${label}<input type="number" min="0" max="10" step="1" name="${name}" value="${value}"></label>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

async function loadPreferences(): Promise<UserPreferences> {
  return chrome.runtime.sendMessage({ type: "GET_PREFERENCES" });
}

async function loadRouteApiConfig(): Promise<RouteApiConfig> {
  return chrome.runtime.sendMessage({ type: "GET_ROUTE_API_CONFIG" });
}

async function init(): Promise<void> {
  const [preferences, routes] = await Promise.all([loadPreferences(), loadRouteApiConfig()]);
  form.innerHTML = `<section><h2>Pesos del score</h2><div class="weights">${field("price", preferences.numeric.price.weight, "Precio")}${field("areaM2", preferences.numeric.areaM2.weight, "Superficie")}${field("pricePerM2", preferences.numeric.pricePerM2.weight, "€/m²")}${field("floor", preferences.numeric.floor.weight, "Planta")}${field("elevator", preferences.boolean.elevator.weight, "Ascensor")}${field("exterior", preferences.boolean.exterior.weight, "Exterior")}</div></section><section class="routes-panel"><div><h2>Rutas a pie al Metro de Madrid</h2><p>OpenRouteService calcula el recorrido a pie; los resultados se cachean por anuncio.</p></div><label>URL de OpenStreetMap Nominatim<input type="url" name="nominatimBaseUrl" value="${escapeHtml(routes.nominatimBaseUrl)}"></label><label>URL de OpenRouteService<input type="url" name="openRouteServiceBaseUrl" value="${escapeHtml(routes.openRouteServiceBaseUrl)}"></label><label>Clave de OpenRouteService<input type="password" name="openRouteServiceApiKey" placeholder="Pega tu clave de ORS" value="${escapeHtml(routes.openRouteServiceApiKey)}" autocomplete="off"></label></section>`;

  document.querySelector("#save")!.addEventListener("click", async () => {
    const data = new FormData(form);
    for (const [key, criterion] of Object.entries(preferences.numeric)) criterion.weight = Number(data.get(key));
    for (const [key, criterion] of Object.entries(preferences.boolean)) criterion.weight = Number(data.get(key));
    const routeConfig: RouteApiConfig = {
      nominatimBaseUrl: String(data.get("nominatimBaseUrl") ?? "").trim().replace(/\/$/, ""),
      openRouteServiceBaseUrl: String(data.get("openRouteServiceBaseUrl") ?? "").trim().replace(/\/$/, ""),
      openRouteServiceApiKey: String(data.get("openRouteServiceApiKey") ?? "").trim()
    };
    await Promise.all([
      chrome.runtime.sendMessage({ type: "SAVE_PREFERENCES", payload: preferences }),
      chrome.runtime.sendMessage({ type: "SAVE_ROUTE_API_CONFIG", payload: routeConfig })
    ]);
    status.value = "Preferencias guardadas.";
  });
}

void init();
