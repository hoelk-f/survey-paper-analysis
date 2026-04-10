import { useEffect, useState, type FormEvent } from "react";

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
  getProviderLabel,
} from "../config/runDefaults";
import { getApiKeyStorageKey } from "../config/storage";
import type { Provider, RunCreatePayload, TemplateSchema } from "../types";
import { SurfaceCard } from "./SurfaceCard";
import { TemplateGuidanceEditor } from "./TemplateGuidanceEditor";
import { TemplatePreview } from "./TemplatePreview";

interface CreateAnalysisInput {
  name?: string;
  template: File;
  papers: File[];
  templateSchema?: TemplateSchema | null;
  initialRun: RunCreatePayload;
}

interface CreateAnalysisModalProps {
  isOpen: boolean;
  isBusy: boolean;
  onClose: () => void;
  onCreate: (input: CreateAnalysisInput) => Promise<void>;
}

const BROWSER_KEY_PROVIDERS = ["openai", "ki4buw"] as const;

function createStepLabel(step: number) {
  if (step === 1) {
    return "Project";
  }
  if (step === 2) {
    return "Template";
  }
  if (step === 3) {
    return "PDFs";
  }
  if (step === 4) {
    return "LLM";
  }
  return "Review";
}

export function CreateAnalysisModal({ isOpen, isBusy, onClose, onCreate }: CreateAnalysisModalProps) {
  const [name, setName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [paperFiles, setPaperFiles] = useState<File[]>([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [provider, setProvider] = useState<Provider>(DEFAULT_PROVIDER);
  const [apiKeys, setApiKeys] = useState<Partial<Record<Provider, string>>>({});
  const [availableModels, setAvailableModels] = useState<string[]>(getModelOptionsForProvider(DEFAULT_PROVIDER));
  const [selectedModel, setSelectedModel] = useState(getDefaultModelForProvider(DEFAULT_PROVIDER));
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState(0.1);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [analystInstructions, setAnalystInstructions] = useState(DEFAULT_ANALYST_INSTRUCTIONS);
  const [templatePreview, setTemplatePreview] = useState<TemplateSchema | null>(null);
  const [templateSchemaDraft, setTemplateSchemaDraft] = useState<TemplateSchema | null>(null);
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false);
  const [templatePreviewError, setTemplatePreviewError] = useState<string | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const apiKey = apiKeys[provider] ?? "";
  const reviewGuidanceSheets =
    templateSchemaDraft?.sheets
      .map((sheet) => ({
        ...sheet,
        columns: sheet.columns.filter((column) => column.description.trim()),
      }))
      .filter((sheet) => sheet.columns.length > 0) ?? [];

  const isTemplateStepComplete = !!templateFile && !!templatePreview && !templatePreviewLoading && !templatePreviewError;
  const isLlmStepComplete = !!selectedModel && !!systemPrompt.trim() && !!analystInstructions.trim() && !modelsLoading;
  const canAccessStep = (step: number) => {
    if (step === 1) {
      return true;
    }
    if (step === 2) {
      return !!name.trim();
    }
    if (step === 3) {
      return !!name.trim() && isTemplateStepComplete;
    }
    if (step === 4) {
      return !!name.trim() && isTemplateStepComplete && paperFiles.length > 0;
    }
    return !!name.trim() && isTemplateStepComplete && paperFiles.length > 0 && isLlmStepComplete;
  };

  const resetWizard = () => {
    setName("");
    setTemplateFile(null);
    setPaperFiles([]);
    setWizardStep(1);
    setProvider(DEFAULT_PROVIDER);
    setAvailableModels(getModelOptionsForProvider(DEFAULT_PROVIDER));
    setSelectedModel(getDefaultModelForProvider(DEFAULT_PROVIDER));
    setModelsError(null);
    setTemperature(0.1);
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setAnalystInstructions(DEFAULT_ANALYST_INSTRUCTIONS);
    setTemplatePreview(null);
    setTemplateSchemaDraft(null);
    setTemplatePreviewLoading(false);
    setTemplatePreviewError(null);
    setReviewConfirmed(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetWizard();
    }
  }, [isOpen]);

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
    if (!isOpen) {
      return;
    }

    setReviewConfirmed(false);
  }, [
    isOpen,
    wizardStep,
    name,
    templateFile,
    paperFiles,
    provider,
    apiKey,
    selectedModel,
    temperature,
    systemPrompt,
    analystInstructions,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!templateFile) {
      setTemplatePreview(null);
      setTemplateSchemaDraft(null);
      setTemplatePreviewLoading(false);
      setTemplatePreviewError(null);
      return;
    }

    let isCancelled = false;
    setTemplatePreview(null);
    setTemplatePreviewLoading(true);
    setTemplatePreviewError(null);

    void (async () => {
      try {
        const schema = await api.previewTemplate(templateFile);
        if (isCancelled) {
          return;
        }
        setTemplatePreview(schema);
        setTemplateSchemaDraft(schema);
      } catch (caughtError) {
        if (isCancelled) {
          return;
        }
        setTemplatePreview(null);
        setTemplateSchemaDraft(null);
        setTemplatePreviewError(caughtError instanceof Error ? caughtError.message : "Template preview could not be loaded.");
      } finally {
        if (!isCancelled) {
          setTemplatePreviewLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, templateFile]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

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
        setSelectedModel((current) => (nextModels.includes(current) ? current : nextModels[0] ?? fallbackModel));
      } catch (caughtError) {
        if (isCancelled) {
          return;
        }
        setAvailableModels(getModelOptionsForProvider(provider));
        setSelectedModel(fallbackModel);
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
  }, [apiKey, isOpen, provider]);

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

  const closeModal = () => {
    if (isBusy) {
      return;
    }
    resetWizard();
    onClose();
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (wizardStep !== 5 || !reviewConfirmed || !templateFile || paperFiles.length === 0) {
      return;
    }

    await onCreate({
      name: name.trim() || undefined,
      template: templateFile,
      papers: paperFiles,
      templateSchema: templateSchemaDraft,
      initialRun: {
        provider,
        model: selectedModel,
        api_key: apiKey.trim() || undefined,
        temperature,
        label: "Version 1",
        system_prompt: systemPrompt.trim(),
        analyst_instructions: analystInstructions.trim(),
      },
    });
  };

  const handleProviderChange = (nextProvider: Provider) => {
    const fallbackModel = getDefaultModelForProvider(nextProvider);
    setProvider(nextProvider);
    setAvailableModels(getModelOptionsForProvider(nextProvider));
    setSelectedModel(fallbackModel);
    setModelsError(null);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-md">
      <div className="absolute inset-0" onClick={closeModal} />
      <div className="relative z-10 w-full max-w-6xl">
        <SurfaceCard
          title="Create New Project"
          action={
            <button
              type="button"
              onClick={closeModal}
              disabled={isBusy}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30"
            >
              Close
            </button>
          }
          className="bg-panel/80"
        >
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid gap-3 md:grid-cols-5">
              {[1, 2, 3, 4, 5].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => {
                    if (canAccessStep(step)) {
                      setWizardStep(step);
                    }
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    wizardStep === step
                      ? "border-accent/50 bg-accent/10"
                      : "border-white/10 bg-panelAlt/50 text-slate-300"
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Step {step}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{createStepLabel(step)}</div>
                </button>
              ))}
            </div>

            {wizardStep === 1 ? (
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Project</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
                  placeholder="Survey Paper Analysis"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            ) : null}

            {wizardStep === 2 ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Template (Excel)</span>
                  <input
                    className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-accent/15 file:px-4 file:py-2 file:font-semibold file:text-accent"
                    type="file"
                    accept=".xlsx,.xlsm"
                    onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                {templatePreviewLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-panelAlt/60 p-4 text-sm text-slate-400">
                    Loading template preview...
                  </div>
                ) : null}

                {templatePreviewError ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    {templatePreviewError}
                  </div>
                ) : null}

                {templateFile && templatePreview ? (
                  <div className="space-y-4">
                    <TemplatePreview
                      filename={templateFile.name}
                      schema={templateSchemaDraft}
                      maxHeightClassName="max-h-[18rem]"
                    />
                    <TemplateGuidanceEditor
                      schema={templateSchemaDraft}
                      onChange={setTemplateSchemaDraft}
                      maxHeightClassName="max-h-[18rem]"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">PDFs</span>
                <input
                  className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-accent/15 file:px-4 file:py-2 file:font-semibold file:text-accent"
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(event) => setPaperFiles(Array.from(event.target.files ?? []))}
                />
                {paperFiles.length > 0 ? <div className="mt-3 text-sm text-slate-300">{paperFiles.length} files selected</div> : null}
              </label>
            ) : null}

            {wizardStep === 4 ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_180px]">
                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">Provider</span>
                    <select
                      className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
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
                      className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
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
                      className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
                      value={selectedModel}
                      onChange={(event) => setSelectedModel(event.target.value)}
                      disabled={modelsLoading}
                    >
                      {availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-slate-300">Temperature</span>
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={temperature}
                      onChange={(event) => setTemperature(Number(event.target.value))}
                    />
                  </label>
                </div>

                {modelsLoading ? <div className="text-sm text-slate-400">Loading models...</div> : null}
                {modelsError ? <div className="text-sm text-amber-200">{modelsError}</div> : null}
                {provider === "ki4buw" ? (
                  <div className="text-sm text-slate-400">Server: https://llm.ki4buw.de/v1</div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">System</span>
                  <textarea
                    className="min-h-28 w-full rounded-[1.75rem] border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Instructions</span>
                  <textarea
                    className="min-h-32 w-full rounded-[1.75rem] border border-white/10 bg-panelAlt/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
                    value={analystInstructions}
                    onChange={(event) => setAnalystInstructions(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {wizardStep === 5 ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-panelAlt/60 p-5">
                  <div className="grid gap-4 md:grid-cols-6">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Project</div>
                      <div className="mt-2 text-sm text-white">{name.trim() || "Untitled"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Template (Excel)</div>
                      <div className="mt-2 text-sm text-white">{templateFile?.name ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">PDFs</div>
                      <div className="mt-2 text-sm text-white">{paperFiles.length}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Provider</div>
                      <div className="mt-2 text-sm text-white">{getProviderLabel(provider)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Model</div>
                      <div className="mt-2 text-sm text-white">{selectedModel}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Temperature</div>
                      <div className="mt-2 text-sm text-white">{temperature}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-panelAlt/60 p-5">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">System</div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{systemPrompt}</pre>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-panelAlt/60 p-5">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Instructions</div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{analystInstructions}</pre>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-panelAlt/60 p-5">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Column Guidance</div>
                  {reviewGuidanceSheets.length > 0 ? (
                    <div className="mt-3 max-h-[20rem] space-y-4 overflow-y-auto pr-1">
                      {reviewGuidanceSheets.map((sheet) => (
                        <div key={sheet.name} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                          <div className="text-sm font-semibold text-white">{sheet.name}</div>
                          <div className="mt-3 space-y-3">
                            {sheet.columns.map((column) => (
                              <div
                                key={`${sheet.name}-${column.name}`}
                                className="rounded-xl border border-white/8 bg-white/5 px-4 py-3"
                              >
                                <div className="text-sm font-medium text-white">{column.name}</div>
                                <div className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
                                  {column.description}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-400">No column guidance added.</div>
                  )}
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-panelAlt/40 p-4">
                  <input
                    type="checkbox"
                    checked={reviewConfirmed}
                    onChange={(event) => setReviewConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-panelAlt/80 text-accent focus:ring-accent/40"
                  />
                  <span className="text-sm text-slate-300">
                    I confirm these settings and want to start the analysis. I confirm that this tool produces a
                    first-pass survey paper extraction, and all extracted information must be reviewed manually before
                    use.
                  </span>
                </label>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={wizardStep === 1}
                onClick={() => setWizardStep((current) => Math.max(1, current - 1))}
                className="rounded-full border border-white/10 px-5 py-3 font-semibold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>

              {wizardStep < 5 ? (
                <button
                  type="button"
                  disabled={
                    (wizardStep === 1 && !name.trim()) ||
                    (wizardStep === 2 && !isTemplateStepComplete) ||
                    (wizardStep === 3 && paperFiles.length === 0) ||
                    (wizardStep === 4 && !isLlmStepComplete)
                  }
                  onClick={() => setWizardStep((current) => Math.min(5, current + 1))}
                  className="rounded-full bg-accent px-5 py-3 font-semibold text-slate-950 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/40"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isBusy || !templateFile || paperFiles.length === 0 || !reviewConfirmed}
                  className="rounded-full bg-accent px-5 py-3 font-semibold text-slate-950 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/40"
                >
                  {isBusy ? "Creating..." : "Start Analysis"}
                </button>
              )}
            </div>
          </form>
        </SurfaceCard>
      </div>
    </div>
  );
}
