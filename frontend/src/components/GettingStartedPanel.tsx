import { SurfaceCard } from "./SurfaceCard";

const steps = [
  { index: "01", title: "Name", detail: "Create the analysis." },
  { index: "02", title: "Template", detail: "Upload the Excel sheet." },
  { index: "03", title: "PDFs", detail: "Add the survey papers." },
  { index: "04", title: "LLM", detail: "Choose key and model." },
  { index: "05", title: "Review", detail: "Confirm and start the first version." },
];

export function GettingStartedPanel() {
  return (
    <SurfaceCard className="mx-auto max-w-5xl text-center">
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-3xl font-semibold text-white">Survey paper extraction</h2>
          <p className="mt-2 text-sm text-slate-400">
            Start a new analysis, map the Excel template, run the PDFs, then refine with versions.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {steps.map((step) => (
            <div key={step.index} className="rounded-2xl border border-white/10 bg-panelAlt/60 p-4 text-left">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{step.index}</div>
              <div className="mt-2 font-semibold text-white">{step.title}</div>
              <div className="mt-2 text-sm text-slate-400">{step.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}
