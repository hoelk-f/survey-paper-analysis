import type { Provider } from "../types";

export const DEFAULT_PROVIDER: Provider = "openai";
export const OPENAI_DEFAULT_MODEL = "gpt-4.1-mini";
export const KI4BUW_DEFAULT_MODEL = "openai/qwen3";
export const KI4BUW_MODELS = [KI4BUW_DEFAULT_MODEL] as const;
export const DEFAULT_MODEL_FALLBACK = OPENAI_DEFAULT_MODEL;

export const AVAILABLE_LLM_PROVIDERS: Array<{ value: Provider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "ki4buw", label: "KI4BUW LLM Server" },
];

export function isSelectableProvider(provider: Provider): boolean {
  return AVAILABLE_LLM_PROVIDERS.some((option) => option.value === provider);
}

export function getDefaultModelForProvider(provider: Provider): string {
  if (provider === "ki4buw") {
    return KI4BUW_DEFAULT_MODEL;
  }
  return OPENAI_DEFAULT_MODEL;
}

export function getModelOptionsForProvider(provider: Provider, preferredModel?: string): string[] {
  const models = provider === "ki4buw" ? [...KI4BUW_MODELS] : [getDefaultModelForProvider(provider)];
  if (preferredModel && !models.includes(preferredModel)) {
    return [preferredModel, ...models];
  }
  return models;
}

export function getProviderLabel(provider: Provider): string {
  if (provider === "ki4buw") {
    return "KI4BUW LLM Server";
  }
  if (provider === "anthropic") {
    return "Anthropic";
  }
  if (provider === "mock") {
    return "Mock";
  }
  return "OpenAI";
}

export function getProviderApiKeyLabel(provider: Provider): string {
  if (provider === "ki4buw") {
    return "KI4BUW API key";
  }
  if (provider === "anthropic") {
    return "Anthropic key";
  }
  return "OpenAI key";
}

export function getProviderApiKeyPlaceholder(provider: Provider): string {
  if (provider === "openai") {
    return "sk-...";
  }
  return "Enter API key";
}

export const DEFAULT_SYSTEM_PROMPT = `You are acting as a senior research synthesis analyst.
Return structured JSON only.
Prefer precise extraction over broad summarization.
Leave blanks when evidence is missing.`;

export const DEFAULT_ANALYST_INSTRUCTIONS = `Fill every sheet row using the uploaded Excel schema.
Use the paper as the only source of truth.
If a field needs normalization, keep the value concise and spreadsheet-friendly.`;
