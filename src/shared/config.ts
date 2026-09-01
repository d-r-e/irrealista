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
