interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "accent";
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "accent",
  isBusy = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!isOpen) {
    return null;
  }

  const confirmClassName =
    tone === "danger"
      ? "border-rose-400/20 bg-rose-400/10 text-rose-100 hover:border-rose-300/40 hover:bg-rose-400/20 disabled:bg-rose-400/10"
      : "border-accent/25 bg-accent/10 text-accent hover:border-accent/45 hover:bg-accent/20 disabled:bg-accent/10";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-md">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!isBusy) {
            onCancel();
          }
        }}
      />
      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-panel/90 p-6 shadow-glow backdrop-blur-2xl">
        <div className="space-y-3">
          <div className="font-display text-2xl font-semibold text-white">{title}</div>
          <p className="text-sm leading-6 text-slate-300">{description}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`rounded-full border px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`.trim()}
          >
            {isBusy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
