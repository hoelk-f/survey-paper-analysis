import type { PropsWithChildren } from "react";

interface AppShellProps extends PropsWithChildren {
  containerClassName?: string;
}

export function AppShell({ containerClassName = "", children }: AppShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 pb-28 text-mist sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[28%] h-[1100px] w-[1100px] -translate-x-1/2 rounded-full border border-fuchsia-300/15 bg-[radial-gradient(circle_at_50%_72%,rgba(255,123,224,0.45),rgba(130,94,255,0.2)_38%,rgba(45,58,116,0.06)_60%,transparent_72%)]" />
        <div className="absolute bottom-[-12%] left-1/2 h-[620px] w-[1400px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,78,222,0.3),transparent_60%)] blur-3xl" />
      </div>

      <div className={`relative z-10 mx-auto w-[90vw] ${containerClassName}`.trim()}>{children}</div>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-slate-950/75 py-4 text-center text-sm text-slate-500 backdrop-blur-xl">
        &copy; TMDT
      </footer>
    </main>
  );
}
