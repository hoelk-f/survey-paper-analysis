import type { ProjectSummary } from "../types";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

interface ProjectListProps {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  deletingProjectId?: string | null;
  onSelect: (projectId: string) => void;
  onDelete: (project: ProjectSummary) => void;
}

export function ProjectList({
  projects,
  selectedProjectId,
  deletingProjectId = null,
  onSelect,
  onDelete,
}: ProjectListProps) {
  return (
    <div className="min-w-[420px] flex-1">
      <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">Projects</div>
      {projects.length === 0 ? (
        <p className="text-sm text-slate-400">No projects yet.</p>
      ) : (
        <div className="h-[248px] space-y-2 overflow-y-scroll pr-2 [scrollbar-gutter:stable]">
          {projects.map((project) => (
            <div key={project.id} className="relative h-14">
              <button
                type="button"
                onClick={() => onSelect(project.id)}
                className={`h-full w-full overflow-hidden rounded-2xl border px-4 py-3 pr-[7rem] text-left transition ${
                  project.id === selectedProjectId
                    ? "border-accent/50 bg-accent/10"
                    : "border-white/8 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex h-full items-center gap-4">
                  <div className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-white">{project.name}</div>
                  <div className="shrink-0 text-xs text-slate-400">{formatDate(project.updated_at)}</div>
                </div>
              </button>
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(project);
                  }}
                  disabled={deletingProjectId === project.id}
                  className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 transition hover:border-rose-300/40 hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingProjectId === project.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
