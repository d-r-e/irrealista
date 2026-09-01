import type { IdealistaListingRaw, PropertyFeatures } from "../schemas/property";
import type { UserPreferences } from "../schemas/preferences";
import type { PropertyScore } from "../scoring/engine";
import type { RouteApiConfig } from "./config";
import type { MetroRoute } from "./metro";
export type ExtensionMessage =
  | { type: "ENRICH_PROPERTY"; payload: IdealistaListingRaw }
  | { type: "GET_PREFERENCES" }
  | { type: "SAVE_PREFERENCES"; payload: UserPreferences }
  | { type: "GET_ROUTE_API_CONFIG" }
  | { type: "SAVE_ROUTE_API_CONFIG"; payload: RouteApiConfig }
  | { type: "GET_METRO_ROUTE"; payload: IdealistaListingRaw };
export interface EnrichedPropertyResponse { property: PropertyFeatures; score: PropertyScore; metroRoute?: MetroRoute | null; }
