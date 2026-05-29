import type { RunDetail } from "../types";
import { SurfaceCard } from "./SurfaceCard";

interface ErrorDetail {
  id: string;
  label: string;
  message: string;
}

function getErrorDetails(run: RunDetail): ErrorDetail[] {
  const paperErrors = run.paper_results.flatMap((paper) =>
    paper.error
      ? [
          {
            id: paper.paper_id,
            label: `Paper ${paper.sequence_number}: ${paper.paper_filename}`,
            message: paper.error,
          },
        ]
      : [],
  );

  if (paperErrors.length > 0) {
    return paperErrors;
  }

  return run.error
    ? [
        {
          id: "run-error",
          label: "Run error",
          message: run.error,
        },
      ]
    : [];
}

interface RunInspectorProps {
  run: RunDetail | null;
  isRetryingFailed?: boolean;
  retryChunkSize?: string;
  onRetryChunkSizeChange?: (value: string) => void;
  onRetryFailed?: () => void;
}

export function RunInspector({
  run,
  isRetryingFailed = false,
  retryChunkSize = "14",
  onRetryChunkSizeChange,
  onRetryFailed,
}: RunInspectorProps) {
  if (!run) {
    return null;
  }

  const errorDetails = getErrorDetails(run);
  if (errorDetails.length === 0) {
    return null;
  }

  const canRetryFailed =
    !!onRetryFailed &&
    run.failed_papers > 0 &&
    (run.status === "completed_with_errors" || run.status === "failed");

  return (
    <SurfaceCard
      title="Details"
      action={
        canRetryFailed ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Chunk Size
              <input
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                value={retryChunkSize}
                onChange={(event) => onRetryChunkSizeChange?.(event.target.value)}
                disabled={isRetryingFailed}
                className="h-8 w-20 rounded-full border border-white/10 bg-white/5 px-3 text-right text-sm font-semibold text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <button
              type="button"
              onClick={onRetryFailed}
              disabled={isRetryingFailed}
              className="rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-200 transition hover:border-sky-300/45 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRetryingFailed ? "..." : `Fix ${run.failed_papers} PDF${run.failed_papers === 1 ? "" : "s"}`}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="max-h-40 overflow-y-auto rounded-2xl border border-amber-400/20 bg-amber-400/10 text-sm text-amber-100">
        {errorDetails.map((error, index) => (
          <div
            key={error.id}
            className={`p-4 ${index > 0 ? "border-t border-amber-400/20" : ""}`}
          >
            <div className="mb-2 font-medium text-amber-50">{error.label}</div>
            <div className="whitespace-pre-wrap break-words">{error.message}</div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
