import { useEffect, useState } from "react";

import { api } from "../api/client";
import { DEFAULT_ANALYST_INSTRUCTIONS, DEFAULT_MODEL_FALLBACK, DEFAULT_SYSTEM_PROMPT } from "../config/runDefaults";
import { OPENAI_API_KEY_STORAGE_KEY } from "../config/storage";
import type { ProjectDetail, RunCreatePayload, RunDetail } from "../types";
import { SurfaceCard } from "./SurfaceCard";

interface RunComposerProps {
  project: ProjectDetail | null;
  selectedRun: RunDetail | null;
  isSubmitting: boolean;
  onSubmit: (payload: RunCreatePayload) => Promise<void>;
  embedded?: boolean;
}

export function RunComposer({ project, selectedRun, isSubmitting, onSubmit, embedded = false }: RunComposerProps) {
  const [model, setModel] = useState(DEFAULT_MODEL_FALLBACK);
  const [apiKey, setApiKey] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([DEFAULT_MODEL_FALLBACK]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.1);
  const [label, setLabel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [analystInstructions, setAnalystInstructions] = useState(DEFAULT_ANALYST_INSTRUCTIONS);

  useEffect(() => {
    const storedApiKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
  }, []);

  useEffect(() => {
    const nextApiKey = apiKey.trim();
    if (!nextApiKey) {
      setAvailableModels([DEFAULT_MODEL_FALLBACK]);
      setModel((current) => current || DEFAULT_MODEL_FALLBACK);
      setModelsLoading(false);
      return;
    }

    let isCancelled = false;
    setModelsLoading(true);

    void (async () => {
      try {
        const response = await api.listOpenAiModels(nextApiKey);
        if (isCancelled) {
          return;
        }
        setAvailableModels(response.models);
        setModel((current) => (response.models.includes(current) ? current : response.models[0] ?? DEFAULT_MODEL_FALLBACK));
      } catch {
        if (isCancelled) {
          return;
        }
        setAvailableModels([DEFAULT_MODEL_FALLBACK]);
        setModel(DEFAULT_MODEL_FALLBACK);
      } finally {
        if (!isCancelled) {
          setModelsLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const nextApiKey = apiKey.trim();
    if (nextApiKey) {
      localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, nextApiKey);
      return;
    }

    localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
  }, [apiKey]);

  useEffect(() => {
    if (!selectedRun) {
      setModel(DEFAULT_MODEL_FALLBACK);
      setTemperature(0.1);
      setLabel("");
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setAnalystInstructions(DEFAULT_ANALYST_INSTRUCTIONS);
      return;
    }

    setModel(
      selectedRun.llm_settings.provider === "openai" && availableModels.includes(selectedRun.llm_settings.model)
        ? selectedRun.llm_settings.model
        : DEFAULT_MODEL_FALLBACK,
    );
    setTemperature(selectedRun.llm_settings.temperature);
    setLabel(`Branch from v${selectedRun.version_number}`);
    setSystemPrompt(selectedRun.system_prompt || DEFAULT_SYSTEM_PROMPT);
    setAnalystInstructions(selectedRun.analyst_instructions || DEFAULT_ANALYST_INSTRUCTIONS);
  }, [availableModels, selectedRun]);

  const submit = async () => {
    if (!project) {
      return;
    }
    await onSubmit({
      parent_run_id: selectedRun?.id ?? undefined,
      provider: "openai",
      model,
      api_key: apiKey.trim() || undefined,
      temperature,
      label: label.trim() || undefined,
      system_prompt: systemPrompt.trim(),
      analyst_instructions: analystInstructions.trim(),
    });
  };

  const content = project ? (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">OpenAI key</span>
          <input
            className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none focus:border-accent/60"
            type="password"
            value={apiKey}
            placeholder="sk-..."
            onChange={(event) => setApiKey(event.target.value)}
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
