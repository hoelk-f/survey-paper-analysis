import { AppLink } from "../components/AppLink";
import { AppShell } from "../components/AppShell";
import { routes } from "../navigation";

const fullTextCard = {
  title: "Full-Text Screening",
  description: "Review the remaining candidate papers in the existing full-text workflow.",
  action: "Open Tool",
  to: routes.fullTextScreening,
  className:
    "bg-[linear-gradient(180deg,rgba(44,18,58,0.96),rgba(11,12,24,0.98))] hover:bg-[linear-gradient(180deg,rgba(63,25,83,0.98),rgba(12,14,29,1))]",
  accentClassName:
    "bg-[radial-gradient(circle_at_top_right,rgba(255,102,214,0.32),transparent_50%)]",
} as const;

export function StartPage() {
  return (
    <AppShell containerClassName="max-w-7xl">
      <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center py-10">
        <section className="w-full">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <h1 className="font-display text-5xl font-bold tracking-[-0.04em] text-white sm:text-7xl">
              SPA - Survey Paper Analysis
            </h1>
          </div>

          <div className="relative mx-auto overflow-hidden rounded-[2.5rem] border border-white/10 bg-panel/45 shadow-glow backdrop-blur-2xl">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_26%,transparent_74%,rgba(255,255,255,0.04))]" />
            <div className="relative min-h-[28rem]">
              <AppLink
                to={fullTextCard.to}
                className={`group relative flex h-full min-h-[28rem] flex-col justify-between overflow-hidden p-8 transition duration-300 ease-out lg:p-12 ${fullTextCard.className}`.trim()}
              >
                <div
                  className={`absolute inset-0 transition duration-300 group-hover:scale-[1.02] ${fullTextCard.accentClassName}`}
                />
                <div className="relative">
                  <h2 className="max-w-[12ch] font-display text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
                    {fullTextCard.title}
                  </h2>
                  <p className="mt-5 max-w-xl text-base leading-7 text-slate-300/90 sm:text-lg">
                    {fullTextCard.description}
                  </p>
                </div>

                <div className="relative mt-10 flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-sm font-semibold text-white/95 backdrop-blur-xl transition group-hover:border-white/20 group-hover:bg-white/10">
                  <span>{fullTextCard.action}</span>
                  <span aria-hidden="true" className="text-lg transition group-hover:translate-x-1">
                    -&gt;
                  </span>
                </div>
              </AppLink>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
