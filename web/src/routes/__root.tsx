import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/site/AppShell";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">something prolly happened</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          that page doesn't exist - or it whimpered away.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">something broke</h1>
        <p className="mt-2 text-sm text-muted-foreground">try again or head home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border hairline px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0a0a0a" },
      { title: "whimper ♡ - a soft Discord bot" },
      { name: "description", content: "whimper is a soft, modern Discord bot for moderation, fun and utility commands." },
      { property: "og:title", content: "whimper ♡" },
      { property: "og:description", content: "A soft, modern Discord bot for moderation, fun and utility commands." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "whimper.wtf" },
      // 👇 PUT YOUR DISCORD EMBED IMAGE HERE
      // Drop the image at /public/og-image.png (1200x630 recommended) and it'll show in Discord/Twitter embeds.
      { property: "og:image", content: "/kitty.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/kitty.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // 👇 PUT YOUR FAVICON HERE
      // Drop your icon at /public/favicon.ico (and optionally favicon.svg / apple-touch-icon.png).
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Outlet />
      </AppShell>
    </QueryClientProvider>
  );
}
