import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, type Command } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cmds")({
  head: () => ({
    meta: [
      { title: "Commands - whimper ♡" },
      {
        name: "description",
        content: "Searchable command list for the whimper Discord bot.",
      },
    ],
  }),
  component: CommandsPage,
});

function CommandsPage() {
  const q = useQuery({
    queryKey: ["commands"],
    queryFn: api.commandsGrouped,
  });
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const categories = q.data ?? {};
  const allCats = Object.keys(categories);

  const filtered = useMemo(() => {
    const out: Record<string, Command[]> = {};
    const needle = query.trim().toLowerCase();
    for (const cat of allCats) {
      if (activeCat && cat !== activeCat) continue;
      const list = categories[cat].filter((c) =>
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        c.description?.toLowerCase().includes(needle),
      );
      if (list.length) out[cat] = list;
    }
    return out;
  }, [categories, query, activeCat, allCats]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Reference
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Commands</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Live from <code className="font-mono text-foreground/80">api.whimper.wtf</code>.
          Search or filter by category.
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search commands…"
          className="w-full rounded-lg border hairline bg-surface/60 py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur outline-none focus:border-foreground/30"
        />
      </div>

      {/* Category chips */}
      {allCats.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Chip active={activeCat === null} onClick={() => setActiveCat(null)}>
            all
          </Chip>
          {allCats.map((cat) => (
            <Chip
              key={cat}
              active={activeCat === cat}
              onClick={() => setActiveCat(cat)}
            >
              {cat}
            </Chip>
          ))}
        </div>
      )}

      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border hairline bg-surface/40"
            />
          ))}
        </div>
      ) : q.isError ? (
        <div className="rounded-xl border hairline bg-surface/60 p-6 text-sm text-muted-foreground">
          Couldn't load commands from the API. Try again in a bit.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(filtered).map(([cat, cmds]) => (
            <div
              key={cat}
              className="rounded-xl border hairline bg-surface/60 p-6 backdrop-blur"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight">
                  {cat}
                </h2>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {cmds.length}
                </span>
              </div>
              <ul className="space-y-3">
                {cmds.map((c) => (
                  <li key={c._id} className="group">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <code className="rounded-md border hairline bg-background px-2 py-1 font-mono text-xs text-foreground">
                        ~{c.name}
                      </code>
                      {c.usage && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {c.usage}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {c.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {Object.keys(filtered).length === 0 && (
            <div className="rounded-xl border hairline bg-surface/60 p-6 text-sm text-muted-foreground md:col-span-2">
              No commands match "{query}".
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-foreground/30 bg-foreground/10 text-foreground"
          : "hairline bg-surface/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
