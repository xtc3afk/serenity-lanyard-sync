import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Treat cached data as fresh for 60s so navigating back to a page
        // doesn't re-fetch from scratch (this was the "3 po 3" symptom —
        // each route mount triggered another network round-trip).
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Let TanStack Query own freshness — Router should serve cached data.
    defaultPreloadStaleTime: 60_000,
  });

  return router;
};
