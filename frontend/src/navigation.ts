export const routes = {
  home: "/",
  fullTextScreening: "/full-text-screening",
} as const;

export type RoutePath = (typeof routes)[keyof typeof routes];

const routeSet = new Set<RoutePath>(Object.values(routes));

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") {
    return routes.home;
  }

  return pathname.replace(/\/+$/, "");
}

export function resolveRoute(pathname: string): RoutePath {
  const normalizedPathname = normalizePathname(pathname);
  return routeSet.has(normalizedPathname as RoutePath) ? (normalizedPathname as RoutePath) : routes.home;
}

export function navigateTo(path: RoutePath) {
  if (window.location.pathname === path) {
    window.scrollTo({ top: 0 });
    return;
  }

  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}
