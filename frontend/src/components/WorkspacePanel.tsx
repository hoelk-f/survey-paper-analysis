import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";

import type { PaperRecord, ProjectDetail, TemplateSchema } from "../types";
import { TemplateGuidanceEditor } from "./TemplateGuidanceEditor";
import { TemplatePreview } from "./TemplatePreview";

interface WorkspacePanelProps {
  project: ProjectDetail | null;
  papers: PaperRecord[];
  templateFilename: string | null;
  templateSchema: TemplateSchema | null;
  templateSchemaDraft: TemplateSchema | null;
  hasTemplateGuidanceChanges: boolean;
  isBusy: boolean;
  deletingPaperId?: string | null;
  onAddPapers: (papers: File[]) => Promise<void>;
  onDeletePaper: (paperId: string) => Promise<void>;
  onReplaceTemplate: (template: File) => Promise<void>;
  onSaveProjectContext: (input: { description: string; researchQuestions: string[] }) => Promise<void>;
  onSaveTemplateGuidance: (templateSchema: TemplateSchema) => Promise<void>;
  onTemplateSchemaDraftChange: (templateSchema: TemplateSchema) => void;
}

function normalizeResearchQuestions(questions: string[] | undefined) {
  const normalized = (questions ?? []).slice(0, 3).map((question) => question.trim());
  return normalized.concat(["", "", ""]).slice(0, 3);
}

export function WorkspacePanel({
  project,
  papers,
  templateFilename,
  templateSchema,
  templateSchemaDraft,
  hasTemplateGuidanceChanges,
  isBusy,
  deletingPaperId = null,
  onAddPapers,
  onDeletePaper,
  onReplaceTemplate,
  onSaveProjectContext,
  onSaveTemplateGuidance,
  onTemplateSchemaDraftChange,
}: WorkspacePanelProps) {
  const [extraPapers, setExtraPapers] = useState<File[]>([]);
  const [replacementTemplate, setReplacementTemplate] = useState<File | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [researchQuestionDrafts, setResearchQuestionDrafts] = useState(["", "", ""]);
  const [isPdfDropActive, setIsPdfDropActive] = useState(false);
  const [paperPickerKey, setPaperPickerKey] = useState(0);
  const [templatePickerKey, setTemplatePickerKey] = useState(0);

  const getPdfFiles = (files: FileList | File[]) =>
    Array.from(files).filter((file) => file.name.toLowerCase().endsWith(".pdf"));

  const handleAddPapers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (extraPapers.length === 0) {
      return;
    }
    await onAddPapers(extraPapers);
    setExtraPapers([]);
    setPaperPickerKey((current) => current + 1);
  };

  const handleReplaceTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!replacementTemplate) {
      return;
    }
    await onReplaceTemplate(replacementTemplate);
    setReplacementTemplate(null);
    setTemplatePickerKey((current) => current + 1);
  };

  const handleSaveProjectContext = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSaveProjectContext({
      description: descriptionDraft.trim(),
      researchQuestions: normalizeResearchQuestions(researchQuestionDrafts),
    });
  };

  const handlePdfDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsPdfDropActive(false);

    if (isBusy) {
      return;
    }

    const droppedPdfs = getPdfFiles(event.dataTransfer.files);
    if (droppedPdfs.length === 0) {
      return;
    }

    await onAddPapers(droppedPdfs);
  };

  const hasPapers = useMemo(() => papers.length > 0, [papers]);
  const hasProjectContextChanges = useMemo(() => {
    if (!project) {
      return false;
    }
    return (
      descriptionDraft.trim() !== project.description.trim() ||
      JSON.stringify(normalizeResearchQuestions(researchQuestionDrafts)) !==
        JSON.stringify(normalizeResearchQuestions(project.research_questions))
    );
  }, [descriptionDraft, project, researchQuestionDrafts]);

  useEffect(() => {
    if (!project) {
      return;
    }
    setDescriptionDraft(project.description);
    setResearchQuestionDrafts(normalizeResearchQuestions(project.research_questions));
  }, [project]);

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-5">
      <form
        className="rounded-2xl border border-white/10 bg-panelAlt/70 p-4"
        onSubmit={handleSaveProjectContext}
      >
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Project Context</div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Description</span>
            <textarea
              className="min-h-24 w-full rounded-[1.75rem] border border-white/10 bg-panel/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            {researchQuestionDrafts.map((question, index) => (
              <label key={index} className="block">
                <span className="mb-2 block text-sm text-slate-300">RQ {index + 1}</span>
                <textarea
                  className="min-h-20 w-full rounded-[1.5rem] border border-white/10 bg-panel/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/60"
                  value={question}
                  onChange={(event) =>
                    setResearchQuestionDrafts((current) =>
                      current.map((currentQuestion, currentIndex) =>
                        currentIndex === index ? event.target.value : currentQuestion,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={isBusy || !hasProjectContextChanges}
            className="rounded-full border border-white/10 px-4 py-2 font-semibold text-white transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Project Context
          </button>
        </div>
      </form>

      <div className="grid gap-5 lg:grid-cols-2">
      <div
        className={`flex h-full flex-col rounded-2xl border bg-panelAlt/70 p-4 transition ${
          isPdfDropActive ? "border-accent/70 bg-accent/10 shadow-glow" : "border-white/10"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isBusy) {
            setIsPdfDropActive(true);
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsPdfDropActive(false);
          }
        }}
        onDrop={(event) => {
          void handlePdfDrop(event);
        }}
      >
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">PDFs</div>
        {isPdfDropActive ? (
          <div className="mb-3 rounded-2xl border border-dashed border-accent/50 bg-accent/10 px-4 py-3 text-sm text-accent">
            Drop PDFs to add them to this version.
          </div>
        ) : null}
        <div className="max-h-[28rem] min-h-[12rem] space-y-3 overflow-y-auto rounded-2xl border border-white/8 bg-black/10 p-2 pr-2 [scrollbar-gutter:stable]">
          {!hasPapers ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
              No PDFs attached.
            </div>
          ) : (
            papers.map((paper) => (
              <div key={paper.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{paper.original_filename}</div>
                  <div className="mt-1 text-xs text-slate-500">{paper.page_count ?? "?"} pages</div>
                </div>
                <button
                  type="button"
                  onClick={() => void onDeletePaper(paper.id)}
                  disabled={isBusy || deletingPaperId === paper.id}
                  className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 transition hover:border-rose-300/40 hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingPaperId === paper.id ? "..." : "Delete"}
                </button>
              </div>
            ))
          )}
        </div>

        <form className="mt-auto space-y-4 pt-5" onSubmit={handleAddPapers}>
          <input
            key={paperPickerKey}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-accent/15 file:px-4 file:py-2 file:font-semibold file:text-accent"
            type="file"
            accept=".pdf"
            multiple
            onChange={(event) => setExtraPapers(Array.from(event.target.files ?? []))}
          />
          <button
            type="submit"
            disabled={isBusy || extraPapers.length === 0}
            className="rounded-full border border-white/10 px-4 py-2 font-semibold text-white transition hover:border-gold/60 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Attach
          </button>
        </form>
      </div>

      <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-panelAlt/70 p-4">
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Template</div>
        <div className="space-y-4">
          <TemplatePreview filename={templateFilename} schema={templateSchemaDraft || templateSchema} />
          <TemplateGuidanceEditor
            schema={templateSchemaDraft}
            onChange={onTemplateSchemaDraftChange}
            maxHeightClassName="max-h-[22rem]"
          />
          <button
            type="button"
            disabled={isBusy || !templateSchemaDraft || !hasTemplateGuidanceChanges}
            onClick={() => templateSchemaDraft ? void onSaveTemplateGuidance(templateSchemaDraft) : undefined}
            className="rounded-full border border-white/10 px-4 py-2 font-semibold text-white transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Column Guidance
          </button>
        </div>

        <form className="mt-auto space-y-4 pt-5" onSubmit={handleReplaceTemplate}>
          <input
            key={templatePickerKey}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-accent/15 file:px-4 file:py-2 file:font-semibold file:text-accent"
            type="file"
            accept=".xlsx,.xlsm"
            onChange={(event) => setReplacementTemplate(event.target.files?.[0] ?? null)}
          />
          <button
            type="submit"
            disabled={isBusy || !replacementTemplate}
            className="rounded-full border border-white/10 px-4 py-2 font-semibold text-white transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Replace
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
