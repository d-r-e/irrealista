import { defaultRouteApiConfig, type RouteApiConfig } from "../shared/config";

const KEY = "routeApiConfig";
const DEPRECATED_ORS_BASE_URL = /^https:\/\/api\.openrouteservice\.org\/?$/i;

export async function getRouteApiConfig(): Promise<RouteApiConfig> {
  const stored = await chrome.storage.local.get(KEY);
  const config = { ...defaultRouteApiConfig, ...(stored[KEY] as Partial<RouteApiConfig> | undefined) };
  if (DEPRECATED_ORS_BASE_URL.test(config.openRouteServiceBaseUrl)) {
    config.openRouteServiceBaseUrl = defaultRouteApiConfig.openRouteServiceBaseUrl;
    await chrome.storage.local.set({ [KEY]: config });
  }
  return config;
}

export async function saveRouteApiConfig(config: RouteApiConfig): Promise<void> {
  await chrome.storage.local.set({ [KEY]: config });
}
