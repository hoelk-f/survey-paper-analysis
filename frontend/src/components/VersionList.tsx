import { resolveApiUrl } from "../api/client";
import type { RunSummary } from "../types";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

interface VersionListProps {
  runs: RunSummary[];
  hasProject?: boolean;
  selectedRunId: string | null;
  deletingRunId?: string | null;
  onSelect: (runId: string) => void;
  onDelete: (run: RunSummary) => void;
}

export function VersionList({
  runs,
  hasProject = true,
  selectedRunId,
  deletingRunId = null,
  onSelect,
  onDelete,
}: VersionListProps) {
  return (
    <div className="min-w-[480px] flex-1">
      <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-slate-500">Versions</div>
      {runs.length === 0 ? (
        <p className="text-sm text-slate-400">{hasProject ? "No versions yet." : "Select a project."}</p>
      ) : (
        <div className="h-[248px] space-y-2 overflow-y-scroll pr-2 [scrollbar-gutter:stable]">
          {[...runs].sort((a, b) => b.version_number - a.version_number).map((run) => (
            <div key={run.id} className="relative h-14">
              <button
                type="button"
                onClick={() => onSelect(run.id)}
                className={`h-full w-full overflow-hidden rounded-2xl border px-4 py-3 pr-[13rem] text-left transition ${
                  run.id === selectedRunId
                    ? "border-accent/50 bg-accent/10"
                    : "border-white/8 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex h-full items-center gap-4">
                  <div className="shrink-0 font-display text-sm font-semibold text-white">v{run.version_number}</div>
                  <div className="min-w-0 flex-1 truncate text-sm text-slate-300">{run.label}</div>
                  <div className="shrink-0 text-xs text-slate-400">{formatDate(run.created_at)}</div>
                </div>
              </button>
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                {run.workbook_download_url ? (
                  <a
                    href={resolveApiUrl(run.workbook_download_url)}
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent transition hover:border-accent/45 hover:bg-accent/20"
                  >
                    Export
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(run);
                  }}
                  disabled={deletingRunId === run.id}
                  className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 transition hover:border-rose-300/40 hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingRunId === run.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
