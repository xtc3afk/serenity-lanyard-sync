import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Trophy, Heart } from "lucide-react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "whimper ♡ - a soft Discord bot" },
      {
        name: "description",
        content:
          "whimper is a soft, modern Discord bot - moderation, fun and utility commands at whimper.wtf.",
      },
      { property: "og:title", content: "whimper ♡" },
      {
        property: "og:description",
        content: "A soft, modern Discord bot. whimper.wtf",
      },
      { property: "og:image", content: "/og-image.png" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const owners = useQuery({ queryKey: ["owners"], queryFn: api.owners });
  const leaderboard = useQuery({
    queryKey: ["leaderboard", 10],
    queryFn: () => api.leaderboard(10),
  });

  const announcement = useQuery({
    queryKey: ["announcement"],
    queryFn: api.announcement,
  });

  return (
    <div className="relative">
      {/* Announcement Banner - Public */}
      {announcement.data && (
        <div
          className="border-b border-foreground/10 py-3.5 text-center text-sm font-medium backdrop-blur"
          style={{
            backgroundColor: (announcement.data.color || "#3b82f6") + "15",
            color: announcement.data.color || "#3b82f6",
          }}
        >
          <div className="mx-auto max-w-5xl px-6">
            <strong>{announcement.data.title}</strong>
            <span className="mx-2 opacity-70">•</span>
            {announcement.data.message}
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pt-24">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span>costumery is a whimper warrior</span>
        </div>

        <h1 className="mt-5 text-5xl font-semibold tracking-tight text-foreground sm:text-7xl">
          whimper<span className="text-muted-foreground">.wtf</span>
        </h1>

        <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          a soft little discord bot. moderation, fun and utility commands -
          quiet, fast, and just here when you need it.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            to="/cmds"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse commands <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border hairline bg-surface/60 px-5 py-2.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-surface"
          >
            Open dashboard
          </Link>
          <a
            href={api.loginUrl()}
            className="inline-flex items-center gap-2 rounded-lg border hairline px-5 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Login with Discord
          </a>
        </div>
      </section>

      {/* Global Reputation Leaderboard */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
              <Trophy className="h-3.5 w-3.5" /> global
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              reputation leaderboard
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              top whimperers across every server ♡
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border hairline bg-surface/60 backdrop-blur">
          {leaderboard.isLoading ? (
            <div className="divide-y divide-foreground/5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-surface/30" />
              ))}
            </div>
          ) : leaderboard.data && leaderboard.data.length > 0 ? (
            <ol className="divide-y divide-foreground/5">
              {leaderboard.data.map((u, i) => (
                <li
                  key={u.userId}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface/40"
                >
                  {i === 0 ? (
                    <img src="/paws1.gif" alt="1st" className="h-8 w-8 object-contain" />
                  ) : i === 1 ? (
                    <img src="/paws2.gif" alt="2nd" className="h-8 w-8 object-contain" />
                  ) : i === 2 ? (
                    <img src="/paws3.gif" alt="3rd" className="h-8 w-8 object-contain" />
                  ) : (
                    <span className="w-8 text-center text-sm font-mono tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                  )}

                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt={u.username}
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-foreground/10"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-background ring-1 ring-foreground/10" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {u.globalName || u.username}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      @{u.username}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm tabular-nums text-foreground">
                    <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                    {u.rep.toLocaleString()}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              no reputation yet - be the first to rep someone ♡
            </div>
          )}
        </div>
      </section>

      {/* Owners */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Team
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">owners</h2>
          </div>
        </div>

        {owners.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border hairline bg-surface/40"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(owners.data ?? []).map((o) => (
              <div
                key={o.discordId}
                className="flex items-center gap-4 rounded-xl border hairline bg-surface/60 p-5 backdrop-blur"
              >
                <img
                  src={o.avatar}
                  alt={o.username}
                  className="h-14 w-14 rounded-full object-cover ring-1 ring-foreground/10"
                />
                <div className="min-w-0">
                  <div className="truncate text-base font-medium text-foreground">
                    {o.globalName || o.username}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          thank you for choosing whimper.wtf ♡
        </p>
        {/* Support Placeholder */}
        <div className="mt-8 rounded-2xl border border-dashed border-foreground/10 bg-surface/40 p-8 text-center backdrop-blur">
          <p className="text-sm text-muted-foreground mb-6">
            there's no support server yet, just dm me on x or discord
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://discord.com/users/1216023255878471763"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border hairline bg-surface px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-surface hover:border-foreground/30 active:scale-[0.985]"
            >
              discord
            </a>
            <a
              href="https://x.com/360strafing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border hairline bg-surface px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-surface hover:border-foreground/30 active:scale-[0.985]"
            >
              x / twitter
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}