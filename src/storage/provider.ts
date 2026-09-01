import { defaultOpenAICompatibleConfig, type OpenAICompatibleConfig } from "../shared/config";

const KEY = "openaiCompatibleConfig";

export async function getProviderConfig(): Promise<OpenAICompatibleConfig> {
  const stored = await chrome.storage.local.get(KEY);
  return { ...defaultOpenAICompatibleConfig, ...(stored[KEY] as Partial<OpenAICompatibleConfig> | undefined) };
}

export async function saveProviderConfig(config: OpenAICompatibleConfig): Promise<void> {
  await chrome.storage.local.set({ [KEY]: config });
}
