import { useEffect, useState } from "react";

import { api } from "../api/client";
import {
  AVAILABLE_LLM_PROVIDERS,
  DEFAULT_ANALYST_INSTRUCTIONS,
  DEFAULT_PROVIDER,
  DEFAULT_SYSTEM_PROMPT,
  getDefaultModelForProvider,
  getModelOptionsForProvider,
  getProviderApiKeyLabel,
  getProviderApiKeyPlaceholder,
  isSelectableProvider,
} from "../config/runDefaults";
import { getApiKeyStorageKey } from "../config/storage";
import type { ProjectDetail, Provider, RunCreatePayload, RunDetail } from "../types";
import { SurfaceCard } from "./SurfaceCard";

interface RunComposerProps {
  project: ProjectDetail | null;
  selectedRun: RunDetail | null;
  isSubmitting: boolean;
  onSubmit: (payload: RunCreatePayload) => Promise<void>;
  embedded?: boolean;
}

const BROWSER_KEY_PROVIDERS = ["openai", "ki4buw"] as const;

export function RunComposer({ project, selectedRun, isSubmitting, onSubmit, embedded = false }: RunComposerProps) {
  const [provider, setProvider] = useState<Provider>(DEFAULT_PROVIDER);
  const [model, setModel] = useState(getDefaultModelForProvider(DEFAULT_PROVIDER));
  const [apiKeys, setApiKeys] = useState<Partial<Record<Provider, string>>>({});
  const [availableModels, setAvailableModels] = useState<string[]>(getModelOptionsForProvider(DEFAULT_PROVIDER));
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState(0.1);
  const [label, setLabel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [analystInstructions, setAnalystInstructions] = useState(DEFAULT_ANALYST_INSTRUCTIONS);
  const apiKey = apiKeys[provider] ?? "";

  useEffect(() => {
    const nextApiKeys: Partial<Record<Provider, string>> = {};
    for (const targetProvider of BROWSER_KEY_PROVIDERS) {
      const storageKey = getApiKeyStorageKey(targetProvider);
      if (!storageKey) {
        continue;
      }
      const storedApiKey = localStorage.getItem(storageKey);
      if (storedApiKey) {
        nextApiKeys[targetProvider] = storedApiKey;
      }
    }
    setApiKeys(nextApiKeys);
  }, []);

  useEffect(() => {
    const fallbackModel = getDefaultModelForProvider(provider);
    let isCancelled = false;
    setModelsLoading(true);
    setModelsError(null);

    void (async () => {
      try {
        const response = await api.listModels(provider, apiKey.trim() || undefined);
        if (isCancelled) {
          return;
        }
        const nextModels = response.models.length > 0 ? response.models : getModelOptionsForProvider(provider);
        setAvailableModels(nextModels);
        setModel((current) => (nextModels.includes(current) ? current : nextModels[0] ?? fallbackModel));
      } catch (caughtError) {
        if (isCancelled) {
          return;
        }
        setAvailableModels(getModelOptionsForProvider(provider));
        setModel(fallbackModel);
        setModelsError(caughtError instanceof Error ? caughtError.message : "Models could not be loaded.");
      } finally {
        if (!isCancelled) {
          setModelsLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [apiKey, provider]);

  useEffect(() => {
    for (const targetProvider of BROWSER_KEY_PROVIDERS) {
      const storageKey = getApiKeyStorageKey(targetProvider);
      if (!storageKey) {
        continue;
      }
      const nextApiKey = apiKeys[targetProvider]?.trim();
      if (nextApiKey) {
        localStorage.setItem(storageKey, nextApiKey);
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [apiKeys]);

  useEffect(() => {
    if (!selectedRun) {
      setProvider(DEFAULT_PROVIDER);
      setModel(getDefaultModelForProvider(DEFAULT_PROVIDER));
      setTemperature(0.1);
      setLabel("");
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setAnalystInstructions(DEFAULT_ANALYST_INSTRUCTIONS);
      return;
    }

    const nextProvider = isSelectableProvider(selectedRun.llm_settings.provider)
      ? selectedRun.llm_settings.provider
      : DEFAULT_PROVIDER;
    const fallbackModel = getDefaultModelForProvider(nextProvider);
    setProvider(nextProvider);
    setModel(selectedRun.llm_settings.provider === nextProvider ? selectedRun.llm_settings.model : fallbackModel);
    setTemperature(selectedRun.llm_settings.temperature);
    setLabel(`Branch from v${selectedRun.version_number}`);
    setSystemPrompt(selectedRun.system_prompt || DEFAULT_SYSTEM_PROMPT);
    setAnalystInstructions(selectedRun.analyst_instructions || DEFAULT_ANALYST_INSTRUCTIONS);
  }, [selectedRun]);

  const submit = async () => {
    if (!project) {
      return;
    }
    await onSubmit({
      parent_run_id: selectedRun?.id ?? undefined,
      provider,
      model,
      api_key: apiKey.trim() || undefined,
      temperature,
      label: label.trim() || undefined,
      system_prompt: systemPrompt.trim(),
      analyst_instructions: analystInstructions.trim(),
    });
  };

  const handleProviderChange = (nextProvider: Provider) => {
    const fallbackModel = getDefaultModelForProvider(nextProvider);
    setProvider(nextProvider);
    setAvailableModels(getModelOptionsForProvider(nextProvider));
    setModel(fallbackModel);
    setModelsError(null);
  };

  const content = project ? (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Provider</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none focus:border-accent/60"
            value={provider}
            onChange={(event) => handleProviderChange(event.target.value as Provider)}
          >
            {AVAILABLE_LLM_PROVIDERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">{getProviderApiKeyLabel(provider)}</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none focus:border-accent/60"
            type="password"
            value={apiKey}
            placeholder={getProviderApiKeyPlaceholder(provider)}
            onChange={(event) =>
              setApiKeys((current) => ({
                ...current,
                [provider]: event.target.value,
              }))
            }
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Model</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none focus:border-accent/60"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={modelsLoading}
          >
            {availableModels.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {modelsLoading ? <div className="text-sm text-slate-400">Loading models...</div> : null}
      {modelsError ? <div className="text-sm text-amber-200">{modelsError}</div> : null}
      {provider === "ki4buw" ? <div className="text-sm text-slate-400">Server: https://llm.ki4buw.de/v1</div> : null}

      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Label Version</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none focus:border-accent/60"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="v-next"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Temp</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none focus:border-accent/60"
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(event) => setTemperature(Number(event.target.value))}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm text-slate-300">System</span>
        <textarea
          className="min-h-28 w-full rounded-[1.75rem] border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none focus:border-accent/60"
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-slate-300">Instructions</span>
        <textarea
          className="min-h-32 w-full rounded-[1.75rem] border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none focus:border-accent/60"
          value={analystInstructions}
          onChange={(event) => setAnalystInstructions(event.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void submit()}
          className="rounded-full bg-accent px-5 py-3 font-semibold text-slate-950 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/40"
        >
          {isSubmitting ? "Starting..." : "Create New Version"}
        </button>
      </div>
    </div>
  ) : null;

  if (embedded) {
    return content;
  }

  return (
    <SurfaceCard title="Survey Paper Analysis">
      {content}
    </SurfaceCard>
  );
}
