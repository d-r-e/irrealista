import type { UserPreferences } from "../schemas/preferences";
import { defaultPreferences } from "../scoring/defaults";
const KEY = "preferences";
export async function getPreferences(): Promise<UserPreferences> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] as Partial<UserPreferences> | undefined;
  if (stored?.scoringModelVersion === defaultPreferences.scoringModelVersion) return stored as UserPreferences;
  const migrated = structuredClone(defaultPreferences);
  for (const [field, criterion] of Object.entries(stored?.numeric ?? {})) if (field in migrated.numeric) Object.assign(migrated.numeric[field as keyof typeof migrated.numeric], { ...criterion, zones: migrated.numeric[field as keyof typeof migrated.numeric].zones });
  for (const [field, criterion] of Object.entries(stored?.boolean ?? {})) if (field in migrated.boolean) Object.assign(migrated.boolean[field as keyof typeof migrated.boolean], criterion);
  if (stored?.hardFilters) migrated.hardFilters = stored.hardFilters;
  await chrome.storage.local.set({ [KEY]: migrated });
  return migrated;
}
export async function savePreferences(preferences: UserPreferences): Promise<void> { await chrome.storage.local.set({ [KEY]: preferences }); }
