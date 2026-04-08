import { useEffect, useState } from "react";

import { routes, resolveRoute, type RoutePath } from "./navigation";
import { DashboardPage } from "./pages/DashboardPage";
import { StartPage } from "./pages/StartPage";

export default function App() {
  const [route, setRoute] = useState<RoutePath>(() => resolveRoute(window.location.pathname));

  useEffect(() => {
    const handleRouteChange = () => {
      const resolvedRoute = resolveRoute(window.location.pathname);
      if (resolvedRoute !== window.location.pathname) {
        window.history.replaceState({}, "", resolvedRoute);
      }

      setRoute(resolvedRoute);
    };

    handleRouteChange();
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  if (route === routes.fullTextScreening) {
    return <DashboardPage />;
  }

  return <StartPage />;
}
