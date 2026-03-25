import type { PaperExtractionResult, RunDetail } from "../types";
import { StatusBadge } from "./StatusBadge";
import { SurfaceCard } from "./SurfaceCard";

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }
  return new Date(value).toLocaleString();
}

function PaperCard({ paper }: { paper: PaperExtractionResult }) {
  const sheetEntries = Object.entries(paper.normalized_output);

  return (
    <article className="rounded-2xl border border-white/8 bg-panelAlt/60 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{paper.sequence_number}. {paper.paper_filename}</div>
          <div className="mt-1 text-sm text-slate-400">
            Started {formatDate(paper.started_at)} - Finished {formatDate(paper.completed_at)}
          </div>
        </div>
        <StatusBadge status={paper.status} />
      </div>

      {paper.notes ? <p className="mt-3 text-sm text-slate-200">{paper.notes}</p> : null}
      {paper.error ? <p className="mt-3 text-sm text-rose-300">{paper.error}</p> : null}

      {paper.validation_warnings.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
          {paper.validation_warnings.join(" ")}
        </div>
      ) : null}

      {sheetEntries.length > 0 ? (
        <div className="mt-4 space-y-4">
          {sheetEntries.map(([sheetName, row]) => (
            <div key={sheetName} className="rounded-2xl border border-white/8 bg-black/10 p-3">
              <div className="mb-3 font-display text-base font-semibold text-white">{sheetName}</div>
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(row).map(([column, value]) => (
                  <div key={`${sheetName}-${column}`} className="rounded-xl bg-white/5 p-3">
                    <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">{column}</div>
                    <div className="text-sm text-slate-100">{value || <span className="text-slate-500">Blank</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {paper.llm_raw_output ? (
        <details className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">Raw model output</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-300">{paper.llm_raw_output}</pre>
        </details>
      ) : null}
    </article>
  );
}

function SectionToggle({
  label,
  collapsed,
  onToggle,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-slate-200 transition hover:border-white/25"
        aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
      >
        {collapsed ? "+" : "-"}
      </button>
      <span>{label}</span>
    </div>
  );
}

export function RunInspector({
  run,
  isCollapsed,
  onToggle,
}: {
  run: RunDetail | null;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <SurfaceCard title={<SectionToggle label="Details" collapsed={isCollapsed} onToggle={onToggle} />}>
      {isCollapsed ? null : !run ? (
        <p className="text-sm text-slate-400">Pick a version.</p>
      ) : (
        <div className="space-y-5">
          {run.error ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              {run.error}
            </div>
          ) : null}

          <details className="rounded-2xl border border-white/10 bg-panelAlt/60 p-4">
            <summary className="cursor-pointer font-semibold text-white">Config</summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">System</div>
                <pre className="whitespace-pre-wrap text-sm text-slate-300">{run.system_prompt || "No custom system prompt"}</pre>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Analyst instructions</div>
                <pre className="whitespace-pre-wrap text-sm text-slate-300">{run.analyst_instructions || "No extra analyst instructions"}</pre>
              </div>
            </div>
          </details>

          {run.paper_results.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-panelAlt/60 p-4 text-sm text-slate-400">
              No paper results yet.
            </div>
          ) : (
            <div className="space-y-4">
              {run.paper_results.map((paper) => (
                <PaperCard key={paper.paper_id} paper={paper} />
              ))}
            </div>
          )}
        </div>
      )}
    </SurfaceCard>
  );
}
