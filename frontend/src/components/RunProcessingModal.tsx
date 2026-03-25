import type { RunDetail } from "../types";

export type RunProcessingMode = "initial" | "refine";

function getHeadline(run: RunDetail | null, mode: RunProcessingMode) {
  if (!run) {
    return mode === "initial" ? "Starting analysis" : "Starting new version";
  }
  if (run.status === "pending") {
    return mode === "initial" ? "Preparing first version" : "Preparing refined version";
  }
  return mode === "initial" ? "Processing survey papers" : "Refining survey papers";
}

function getProgress(run: RunDetail | null) {
  if (!run || run.total_papers === 0) {
    return 10;
  }

  const ratio = run.completed_papers / run.total_papers;
  return Math.min(100, Math.max(12, Math.round(ratio * 100)));
}

function getEyebrow(mode: RunProcessingMode) {
  return mode === "initial" ? "Initial run" : "Refine version";
}

function getDescription(mode: RunProcessingMode) {
  return mode === "initial"
    ? "PDFs are analyzed one by one. The first version will open automatically when processing finishes."
    : "PDFs are analyzed one by one. The new version will open automatically when processing finishes.";
}

function getProgressLabel(run: RunDetail | null, mode: RunProcessingMode) {
  if (!run) {
    return mode === "initial" ? "Preparing..." : "Creating...";
  }
  return mode === "initial" ? "Initial processing" : "Version processing";
}

export function RunProcessingModal({
  isOpen,
  run,
  mode,
}: {
  isOpen: boolean;
  run: RunDetail | null;
  mode: RunProcessingMode;
}) {
  if (!isOpen) {
    return null;
  }

  const progress = getProgress(run);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-panel/90 p-8 shadow-glow backdrop-blur-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-fuchsia-300/20" />
            <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-accent border-r-fuchsia-300/80" />
            <div className="absolute inset-4 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(255,90,213,0.28),rgba(123,83,255,0.1),transparent_70%)]" />
          </div>

          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{getEyebrow(mode)}</div>
          <h2 className="mt-3 font-display text-3xl font-semibold text-white">{getHeadline(run, mode)}</h2>
          <p className="mt-3 text-sm text-slate-400">{getDescription(mode)}</p>

          <div className="mt-8 w-full">
            <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
              <span>{getProgressLabel(run, mode)}</span>
              <span>{run ? `${run.completed_papers}/${run.total_papers} PDFs` : "Starting..."}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,90,213,0.92),rgba(127,86,217,0.92),rgba(76,110,245,0.92))] transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
