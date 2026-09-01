export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  visionEnabled: boolean;
}

export const defaultOpenAICompatibleConfig: OpenAICompatibleConfig = {
  baseUrl: "",
  apiKey: "",
  model: "",
  visionEnabled: false
};

export interface RouteApiConfig {
  nominatimBaseUrl: string;
  openRouteServiceBaseUrl: string;
  openRouteServiceApiKey: string;
}

export const defaultRouteApiConfig: RouteApiConfig = {
  nominatimBaseUrl: "https://nominatim.openstreetmap.org",
  openRouteServiceBaseUrl: "https://api.heigit.org/openrouteservice",
  openRouteServiceApiKey: ""
};
