import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { ConfirmModal } from "../components/ConfirmModal";
import { CreateAnalysisModal } from "../components/CreateAnalysisModal";
import { GettingStartedPanel } from "../components/GettingStartedPanel";
import { ProjectList } from "../components/ProjectList";
import { RunComposer } from "../components/RunComposer";
import { RunProcessingModal, type RunProcessingMode } from "../components/RunProcessingModal";
import { SurfaceCard } from "../components/SurfaceCard";
import { VersionList } from "../components/VersionList";
import { WorkspacePanel } from "../components/WorkspacePanel";
import type { PaperRecord, ProjectDetail, ProjectSummary, RunCreatePayload, RunDetail, RunSummary, TemplateSchema } from "../types";

const PROJECT_STORAGE_KEY = "survey-paper-analysis:selected-project-id";

function isActiveRun(run: RunSummary | RunDetail | null) {
  return run?.status === "pending" || run?.status === "running";
}

type VersionPaperDraft = PaperRecord & {
  file?: File | null;
};

type ConfirmDialogState =
  | { kind: "delete-run"; run: RunSummary }
  | { kind: "delete-project"; project: ProjectSummary }
  | null;

function cloneTemplateSchema(schema: TemplateSchema | null): TemplateSchema | null {
  return schema ? (JSON.parse(JSON.stringify(schema)) as TemplateSchema) : null;
}

function mergeTemplateGuidance(baseSchema: TemplateSchema, guidanceSchema: TemplateSchema | null): TemplateSchema {
  if (!guidanceSchema) {
    return cloneTemplateSchema(baseSchema)!;
  }

  return {
    workbook_filename: baseSchema.workbook_filename,
    sheets: baseSchema.sheets.map((sheet) => {
      const guidanceSheet = guidanceSchema.sheets.find((candidate) => candidate.name === sheet.name);
      return {
        ...sheet,
        columns: sheet.columns.map((column) => ({
          ...column,
          description:
            guidanceSheet?.columns.find((candidate) => candidate.name === column.name)?.description ?? "",
        })),
      };
    }),
  };
}

export function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [isProjectBusy, setIsProjectBusy] = useState(false);
  const [isRunBusy, setIsRunBusy] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [processingRunId, setProcessingRunId] = useState<string | null>(null);
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
  const [processingMode, setProcessingMode] = useState<RunProcessingMode>("initial");
  const [templateSchemaDraft, setTemplateSchemaDraft] = useState<TemplateSchema | null>(null);
  const [appliedTemplateSchema, setAppliedTemplateSchema] = useState<TemplateSchema | null>(null);
  const [versionTemplateFilename, setVersionTemplateFilename] = useState<string | null>(null);
  const [versionTemplateFile, setVersionTemplateFile] = useState<File | null>(null);
  const [versionPaperDrafts, setVersionPaperDrafts] = useState<VersionPaperDraft[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSelectProject = (projectId: string | null) => {
    if (projectId === selectedProjectId) {
      return;
    }

    setSelectedRunId(null);
    setSelectedRun(null);
    setRuns([]);
    setProject(null);
    setSelectedProjectId(projectId);
  };

  const reloadProjects = async (preferredProjectId?: string | null) => {
    const list = await api.listProjects();
    setProjects(list);

    const storedProjectId = localStorage.getItem(PROJECT_STORAGE_KEY);
    const nextProjectId =
      preferredProjectId ??
      selectedProjectId ??
      storedProjectId ??
      list[0]?.id ??
      null;

    if (nextProjectId && list.some((item) => item.id === nextProjectId)) {
      handleSelectProject(nextProjectId);
    } else if (list[0]) {
      handleSelectProject(list[0].id);
    } else {
      handleSelectProject(null);
    }
  };

  const reloadProjectContext = async (projectId: string, preserveRunSelection = true) => {
    const [projectDetail, runList] = await Promise.all([
      api.getProject(projectId),
      api.listRuns(projectId),
    ]);

    setProject(projectDetail);
    setRuns(runList);

    const sortedRuns = [...runList].sort((left, right) => right.version_number - left.version_number);
    const nextRunId =
      preserveRunSelection && selectedRunId && runList.some((run) => run.id === selectedRunId)
        ? selectedRunId
        : sortedRuns[0]?.id ?? null;
    setSelectedRunId(nextRunId);

    if (!nextRunId) {
      setSelectedRun(null);
      return;
    }

    const runDetail = await api.getRun(projectId, nextRunId);
    setSelectedRun(runDetail);
  };

  useEffect(() => {
    void (async () => {
      try {
        await reloadProjects();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load projects.");
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
      return;
    }

    localStorage.setItem(PROJECT_STORAGE_KEY, selectedProjectId);
    void (async () => {
      try {
        await reloadProjectContext(selectedProjectId);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load analysis.");
      }
    })();
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedRunId) {
      setSelectedRun(null);
      return;
    }

    if (!runs.some((run) => run.id === selectedRunId)) {
      return;
    }

    void (async () => {
      try {
        const runDetail = await api.getRun(selectedProjectId, selectedRunId);
        setSelectedRun(runDetail);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load run detail.");
      }
    })();
  }, [selectedProjectId, selectedRunId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    const shouldPoll = runs.some((run) => isActiveRun(run)) || isActiveRun(selectedRun);
    if (!shouldPoll) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          await reloadProjectContext(selectedProjectId);
        } catch (caughtError) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to refresh active run.");
        }
      })();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [selectedProjectId, runs, selectedRun]);

  useEffect(() => {
    if (!isProcessingModalOpen || !processingRunId) {
      return;
    }

    if (selectedRun?.id !== processingRunId) {
      return;
    }

    if (!isActiveRun(selectedRun)) {
      setIsProcessingModalOpen(false);
      setProcessingRunId(null);
      setProcessingMode("initial");
    }
  }, [isProcessingModalOpen, processingRunId, selectedRun]);

  useEffect(() => {
    const baseTemplateSchema = selectedRun?.template_schema_snapshot ?? project?.template_schema ?? null;
    const baseTemplateFilename = selectedRun?.template_filename_snapshot ?? project?.template_filename ?? null;
    const basePapers = selectedRun?.papers_snapshot ?? project?.papers ?? [];

    const clonedSchema = cloneTemplateSchema(baseTemplateSchema);
    setTemplateSchemaDraft(clonedSchema);
    setAppliedTemplateSchema(clonedSchema ? cloneTemplateSchema(clonedSchema) : null);
    setVersionTemplateFilename(baseTemplateFilename);
    setVersionTemplateFile(null);
    setVersionPaperDrafts(basePapers.map((paper) => ({ ...paper, file: null })));
  }, [project?.id, selectedRun?.id]);

  const hasTemplateGuidanceChanges = useMemo(() => {
    return JSON.stringify(templateSchemaDraft) !== JSON.stringify(appliedTemplateSchema);
  }, [appliedTemplateSchema, templateSchemaDraft]);

  const handleCreateProject = async (input: {
    name?: string;
    template: File;
    papers: File[];
    templateSchema?: TemplateSchema | null;
    initialRun: RunCreatePayload;
  }) => {
    setIsProjectBusy(true);
    setError(null);
    try {
      const created = await api.createProject(input);
      const createdRun = await api.createRun(created.id, input.initialRun);
      await reloadProjects(created.id);
      await reloadProjectContext(created.id, false);
      setSelectedRun(createdRun);
      setSelectedRunId(createdRun.id);
      setIsCreateModalOpen(false);
      setProcessingRunId(createdRun.id);
      setProcessingMode("initial");
      setIsProcessingModalOpen(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to create analysis.");
    } finally {
      setIsProjectBusy(false);
    }
  };

  const handleSaveTemplateGuidance = async (templateSchema: TemplateSchema) => {
    setAppliedTemplateSchema(cloneTemplateSchema(templateSchema));
  };

  const handleAddPapers = async (papers: File[]) => {
    const existingNames = new Set(versionPaperDrafts.map((paper) => paper.original_filename.toLowerCase()));
    const additions = papers
      .filter((paper) => !existingNames.has(paper.name.toLowerCase()))
      .map<VersionPaperDraft>((paper) => ({
        id: `draft-${crypto.randomUUID()}`,
        original_filename: paper.name,
        stored_filename: paper.name,
        uploaded_at: new Date().toISOString(),
        page_count: null,
        file: paper,
      }));

    if (additions.length === 0) {
      return;
    }

    setVersionPaperDrafts((current) => [...current, ...additions]);
  };

  const handleReplaceTemplate = async (template: File) => {
    setIsProjectBusy(true);
    setError(null);
    try {
      const preview = await api.previewTemplate(template);
      const mergedSchema = mergeTemplateGuidance(preview, templateSchemaDraft ?? appliedTemplateSchema);
      setVersionTemplateFile(template);
      setVersionTemplateFilename(template.name);
      setAppliedTemplateSchema(cloneTemplateSchema(mergedSchema));
      setTemplateSchemaDraft(cloneTemplateSchema(mergedSchema));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to preview template.");
    } finally {
      setIsProjectBusy(false);
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    setDeletingPaperId(paperId);
    setVersionPaperDrafts((current) => current.filter((paper) => paper.id !== paperId));
    setDeletingPaperId(null);
  };

  const handleCreateRun = async (payload: RunCreatePayload) => {
    if (!selectedProjectId) {
      return;
    }
    setIsRunBusy(true);
    setError(null);
    try {
      const effectiveTemplateSchema = cloneTemplateSchema(templateSchemaDraft ?? appliedTemplateSchema);
      if (!effectiveTemplateSchema) {
        throw new Error("A template is required to create a version.");
      }

      const retainedPaperIds = versionPaperDrafts.filter((paper) => !paper.file).map((paper) => paper.id);
      const newPaperFiles = versionPaperDrafts.flatMap((paper) => (paper.file ? [paper.file] : []));

      const created = await api.createRun(
        selectedProjectId,
        {
          ...payload,
          retained_paper_ids: retainedPaperIds,
          template_schema: effectiveTemplateSchema,
        },
        {
          template: versionTemplateFile,
          papers: newPaperFiles,
        },
      );
      await reloadProjectContext(selectedProjectId, false);
      await reloadProjects(selectedProjectId);
      setSelectedRunId(created.id);
      setSelectedRun(created);
      setProcessingRunId(created.id);
      setProcessingMode("refine");
      setIsProcessingModalOpen(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to create run.");
    } finally {
      setIsRunBusy(false);
    }
  };

  const handleDeleteRun = async (run: RunSummary) => {
    setConfirmDialog({ kind: "delete-run", run });
  };

  const handleDeleteProject = async (projectSummary: ProjectSummary) => {
    setConfirmDialog({ kind: "delete-project", project: projectSummary });
  };

  const handleConfirmDialog = async () => {
    if (!confirmDialog) {
      return;
    }

    if (confirmDialog.kind === "delete-run") {
      const run = confirmDialog.run;
      if (!selectedProjectId) {
        setConfirmDialog(null);
        return;
      }

      setDeletingRunId(run.id);
      setError(null);
      try {
        await api.deleteRun(selectedProjectId, run.id);
        await reloadProjectContext(selectedProjectId, false);
        await reloadProjects(selectedProjectId);
        setConfirmDialog(null);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to delete version.");
      } finally {
        setDeletingRunId(null);
      }
      return;
    }

    const projectSummary = confirmDialog.project;
    setDeletingProjectId(projectSummary.id);
    setError(null);
    try {
      await api.deleteProject(projectSummary.id);
      if (selectedProjectId === projectSummary.id) {
        setSelectedRunId(null);
        setSelectedRun(null);
        setProject(null);
        setRuns([]);
      }
      await reloadProjects(projectSummary.id === selectedProjectId ? null : selectedProjectId);
      setConfirmDialog(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to delete project.");
    } finally {
      setDeletingProjectId(null);
    }
  };

  const closeConfirmDialog = () => {
    if (deletingProjectId || deletingRunId) {
      return;
    }

    setConfirmDialog(null);
  };

  const isConfirmDialogBusy =
    (confirmDialog?.kind === "delete-run" && deletingRunId === confirmDialog.run.id) ||
    (confirmDialog?.kind === "delete-project" && deletingProjectId === confirmDialog.project.id);

  const confirmDialogTitle =
    confirmDialog?.kind === "delete-run"
      ? `Delete version v${confirmDialog.run.version_number}?`
      : confirmDialog?.kind === "delete-project"
        ? "Delete project?"
        : "";

  const confirmDialogDescription =
    confirmDialog?.kind === "delete-run"
      ? "This removes the selected version and its generated outputs."
      : confirmDialog?.kind === "delete-project"
        ? `This removes "${confirmDialog.project.name}" and all versions inside it.`
        : "";

  const confirmDialogActionLabel =
    confirmDialog?.kind === "delete-run"
      ? "Delete Version"
      : confirmDialog?.kind === "delete-project"
        ? "Delete Project"
        : "Confirm";

  const confirmDialogCancelLabel =
    confirmDialog?.kind === "delete-project"
      ? "Keep Project"
      : confirmDialog?.kind === "delete-run"
        ? "Keep Version"
        : "Cancel";

  const hasSelectedProject = !!selectedProjectId;
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 pb-28 text-mist sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[28%] h-[1100px] w-[1100px] -translate-x-1/2 rounded-full border border-fuchsia-300/15 bg-[radial-gradient(circle_at_50%_72%,rgba(255,123,224,0.45),rgba(130,94,255,0.2)_38%,rgba(45,58,116,0.06)_60%,transparent_72%)]" />
        <div className="absolute bottom-[-12%] left-1/2 h-[620px] w-[1400px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,78,222,0.3),transparent_60%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-[90vw]">
        <header className="mb-10 flex flex-col gap-5 py-10 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-col gap-4 pt-2 xl:flex-row xl:items-center xl:gap-5">
            <h1 className="font-display text-5xl font-bold tracking-[-0.04em] text-white sm:text-7xl">
              SPA - Survey Paper Analysis
            </h1>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-accent/90"
            >
              Create New Project
            </button>
          </div>
          <div className="grid w-full gap-5 xl:max-w-[1120px] xl:grid-cols-2 xl:self-start">
            <ProjectList
              projects={projects}
              selectedProjectId={selectedProjectId}
              deletingProjectId={deletingProjectId}
              onSelect={handleSelectProject}
              onDelete={handleDeleteProject}
            />
            <VersionList
              runs={runs}
              hasProject={hasSelectedProject}
              selectedRunId={selectedRunId}
              deletingRunId={deletingRunId}
              onSelect={setSelectedRunId}
              onDelete={handleDeleteRun}
            />
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {isBootstrapping ? (
          <div className="rounded-3xl border border-white/10 bg-panel/40 p-8 text-center text-slate-400 backdrop-blur-2xl">
            Loading...
          </div>
        ) : hasSelectedProject ? (
          <div className="space-y-6">
            <SurfaceCard title="Refine Version">
              <div className="space-y-6">
                {project ? (
                  <div className="space-y-6">
                    <WorkspacePanel
                      project={project}
                      papers={versionPaperDrafts}
                      templateFilename={versionTemplateFilename}
                      templateSchema={appliedTemplateSchema}
                      templateSchemaDraft={templateSchemaDraft}
                      hasTemplateGuidanceChanges={hasTemplateGuidanceChanges}
                      isBusy={isProjectBusy}
                      deletingPaperId={deletingPaperId}
                      onAddPapers={handleAddPapers}
                      onDeletePaper={handleDeletePaper}
                      onReplaceTemplate={handleReplaceTemplate}
                      onSaveTemplateGuidance={handleSaveTemplateGuidance}
                      onTemplateSchemaDraftChange={setTemplateSchemaDraft}
                    />
                    <RunComposer
                      project={project}
                      selectedRun={selectedRun}
                      isSubmitting={isRunBusy}
                      onSubmit={handleCreateRun}
                      embedded
                    />
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No analysis selected.</p>
                )}
              </div>
            </SurfaceCard>
          </div>
        ) : (
          <div className="flex min-h-[calc(100vh-24rem)] items-center justify-center">
            <GettingStartedPanel />
          </div>
        )}
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-slate-950/75 py-4 text-center text-sm text-slate-500 backdrop-blur-xl">
        &copy; TMDT
      </footer>

      <CreateAnalysisModal
        isOpen={isCreateModalOpen}
        isBusy={isProjectBusy}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateProject}
      />
      <RunProcessingModal
        isOpen={isProcessingModalOpen}
        run={selectedRun?.id === processingRunId ? selectedRun : null}
        mode={processingMode}
      />
      <ConfirmModal
        isOpen={!!confirmDialog}
        title={confirmDialogTitle}
        description={confirmDialogDescription}
        confirmLabel={confirmDialogActionLabel}
        cancelLabel={confirmDialogCancelLabel}
        tone="danger"
        isBusy={!!isConfirmDialogBusy}
        onCancel={closeConfirmDialog}
        onConfirm={() => {
          void handleConfirmDialog();
        }}
      />
    </main>
  );
}
