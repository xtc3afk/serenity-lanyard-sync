import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LogIn,
  ShieldAlert,
  Server,
  ChevronRight,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { isAdmin } from "@/lib/session";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - whimper ♡" },
      {
        name: "description",
        content: "Manage the servers you own with whimper.",
      },
    ],
  }),
  component: DashboardPage,
});

function guildIconUrl(id: string, icon?: string | null) {
  if (!icon) return null;
  if (icon.startsWith("http")) return icon;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${ext}?size=128`;
}


function DashboardPage() {
  const { data: meData, isLoading: meLoading } = useMe();
  const user = meData?.user ?? null;

  const guilds = useQuery({
    queryKey: ["myGuilds"],
    queryFn: api.myGuilds,
    enabled: !!user,
  });

  if (!meLoading && !user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="rounded-full border hairline bg-surface/60 p-5">
          <LogIn className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            sign in required
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            log in with Discord to see the servers you own.
          </p>
        </div>
        <a
          href={api.loginUrl()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <LogIn className="h-4 w-4" /> Sign in with Discord
        </a>
      </div>
    );
  }

// Show every guild the backend returned for this user. The /api/user/guilds
// endpoint is expected to already scope to manageable guilds; doing a strict
// BigInt permissions check client-side was hiding legitimately owned servers
// when the backend omitted the `permissions` field.
const managedGuilds = guilds.data ?? [];

const withBot = managedGuilds.filter((g: any) => g.botPresent !== false);
const withoutBot = managedGuilds.filter((g: any) => g.botPresent === false);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Your servers
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {user
              ? `signed in as ${user.globalName || user.username}. pick a server to see all its stats.`
              : "..."}
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            {isAdmin(user) && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 rounded-lg border hairline bg-surface/60 px-3 py-2 text-sm text-muted-foreground backdrop-blur hover:text-foreground"
              >
                <ShieldAlert className="h-4 w-4" /> Admin
              </Link>
            )}
            <div className="flex items-center gap-3 rounded-lg border hairline bg-surface/60 px-3 py-2 text-sm backdrop-blur">
              <img
                src={user.avatar}
                alt={user.username}
                className="h-7 w-7 rounded-full object-cover"
              />
              <span className="text-foreground">
                {user.globalName || user.username}
              </span>
            </div>
            <a
              href={api.logoutUrl()}
              className="rounded-lg border hairline bg-surface/60 px-3 py-2 text-xs text-muted-foreground backdrop-blur hover:text-foreground"
            >
              sign out
            </a>
          </div>
        )}
      </header>

      {guilds.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border hairline bg-surface/40"
            />
          ))}
        </div>
      ) : managedGuilds.length === 0 ? (
        <div className="rounded-xl border hairline bg-surface/60 p-10 text-center backdrop-blur">
          <Server className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            you don't own any servers - or we couldn't reach Discord.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
              with whimper · {withBot.length}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {withBot.map((g) => (
                <GuildCard key={g.id} g={g} />
              ))}
            </div>
          </section>

          {withoutBot.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                without whimper · {withoutBot.length}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {withoutBot.map((g) => (
                  <GuildCard key={g.id} g={g} disabled />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function GuildCard({
  g,
  disabled,
}: {
  g: import("@/lib/api").OwnedGuild;
  disabled?: boolean;
}) {
  const icon = guildIconUrl(g.id, g.icon);

  const inner = (
    <>
      {icon ? (
        <img
          src={icon}
          alt={g.name}
          className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-foreground/10"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border hairline bg-background text-sm font-semibold text-foreground">
          {g.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {g.name}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          {g.memberCount != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {g.memberCount.toLocaleString()}
            </span>
          )}
          {disabled ? (
            <span>bot not in server</span>
          ) : (
            <span className="text-foreground/70">view stats</span>
          )}
        </div>
      </div>
      {!disabled && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </>
  );

  if (disabled) {
    return (
      <a
        href={`https://discord.com/api/oauth2/authorize?client_id=1504428504710647859&permissions=8&scope=bot+applications.commands&guild_id=${g.id}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-4 rounded-xl border hairline bg-surface/30 p-4 opacity-70 backdrop-blur transition-colors hover:bg-surface/50 hover:opacity-100"
      >
        {inner}
      </a>
    );
  }

  return (
    <Link
      to="/dashboard/$guildId"
      params={{ guildId: g.id }}
      className="flex items-center gap-4 rounded-xl border hairline bg-surface/60 p-4 backdrop-blur transition-colors hover:bg-surface"
    >
      {inner}
    </Link>
  );
}
