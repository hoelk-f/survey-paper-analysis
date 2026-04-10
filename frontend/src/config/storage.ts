import type { Provider } from "../types";

export const OPENAI_API_KEY_STORAGE_KEY = "spa-openai-api-key";
export const KI4BUW_API_KEY_STORAGE_KEY = "spa-ki4buw-api-key";

const API_KEY_STORAGE_KEYS: Partial<Record<Provider, string>> = {
  openai: OPENAI_API_KEY_STORAGE_KEY,
  ki4buw: KI4BUW_API_KEY_STORAGE_KEY,
};

export function getApiKeyStorageKey(provider: Provider): string | null {
  return API_KEY_STORAGE_KEYS[provider] ?? null;
}
