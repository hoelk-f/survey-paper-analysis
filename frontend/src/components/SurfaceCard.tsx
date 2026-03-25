import type { PropsWithChildren, ReactNode } from "react";

interface SurfaceCardProps extends PropsWithChildren {
  title?: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function SurfaceCard({ title, subtitle, action, className = "", children }: SurfaceCardProps) {
  return (
    <section
      className={`rounded-[2rem] border border-white/10 bg-panel/50 p-6 shadow-glow backdrop-blur-2xl ${className}`.trim()}
    >
      {title || subtitle || action ? (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title ? <div className="font-display text-xl font-semibold tracking-tight text-white">{title}</div> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-400/90">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
