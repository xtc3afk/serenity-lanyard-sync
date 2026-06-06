import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ShieldAlert,
  Users,
  AlertTriangle,
  Server,
  Ban,
  Check,
  X,
  Trash2,
  Plus,
  LogIn,
  Megaphone,
} from "lucide-react";
import { api, type WarnEntry, type AppealEntry, type GuildEntry, type BlockedGuild, type Announcement } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { isAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin - whimper ♡" }],
  }),
  component: AdminPage,
});

type Tab = "warns" | "appeals" | "guilds" | "blocked" | "announcements";

function AdminPage() {
  const { data: meData, isLoading: meLoading } = useMe();
  const user = meData?.user ?? null;
  const [tab, setTab] = useState<Tab>("announcements");
  const [blockInput, setBlockInput] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const qc = useQueryClient();

  // Not logged in
  if (!meLoading && !user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center">
        <LogIn className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">you need to be logged in to access this page.</p>
        </div>
        <a href={api.loginUrl()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <LogIn className="h-4 w-4" /> Sign in with Discord
        </a>
      </div>
    );
  }

  // Not admin
  if (!meLoading && user && !isAdmin(user)) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">access denied</h1>
        <p className="text-sm text-muted-foreground">you don't have permission to view this page.</p>
        <Link to="/dashboard" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          back to dashboard
        </Link>
      </div>
    );
  }

  if (meLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface/60" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "announcements", label: "Announcements", icon: Megaphone },
    { id: "warns", label: "Warns", icon: AlertTriangle },
    { id: "appeals", label: "Appeals", icon: ShieldAlert },
    { id: "guilds", label: "Guilds", icon: Server },
    { id: "blocked", label: "Blocked", icon: Ban },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Header */}
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Control Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            signed in as{" "}
            <span className="text-foreground">{user?.globalName || user?.username}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard" className="rounded-lg border hairline bg-surface/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            ← dashboard
          </Link>
          <a href={api.logoutUrl()} className="rounded-lg border hairline bg-surface/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            sign out
          </a>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border hairline bg-surface/40 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              tab === id
                ? "bg-surface text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "announcements" && <AnnouncementsTab qc={qc} />}
      {tab === "warns" && <WarnsTab qc={qc} />}
      {tab === "appeals" && <AppealsTab qc={qc} />}
      {tab === "guilds" && <GuildsTab />}
      {tab === "blocked" && (
        <BlockedTab
          qc={qc}
          blockInput={blockInput}
          setBlockInput={setBlockInput}
          blockReason={blockReason}
          setBlockReason={setBlockReason}
        />
      )}
    </div>
  );
}

// ── Announcements Tab ───────────────────────────────────────────────────────

function AnnouncementsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data, isLoading } = useQuery({
    queryKey: ["announcement"],
    queryFn: api.announcement,
  });

  const announcement = data ?? null;

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [color, setColor] = useState("#a855f7");

  const create = useMutation({
    mutationFn: () => api.admin.setAnnouncement({ title, message, color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcement"] });
      setTitle("");
      setMessage("");
      setColor("#a855f7");
      alert("✅ Announcement published successfully!");
    },
    onError: (err: any) => {
      console.error(err);
      alert("Failed to publish: " + (err.message || "Unknown error"));
    },
  });

  const remove = useMutation({
    mutationFn: api.admin.deleteAnnouncement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcement"] });
      alert("Announcement removed.");
    },
    onError: () => alert("Failed to remove announcement."),
  });

  if (isLoading) return <div className="py-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Create New Announcement */}
      <div className="rounded-xl border hairline bg-surface/60 p-6">
        <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <Megaphone className="h-5 w-5" /> Create Announcement
        </h3>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Announcement Title (e.g. Maintenance Notice)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border hairline bg-background px-4 py-3 text-sm outline-none focus:border-foreground/30"
          />

          <textarea
            placeholder="Write your announcement here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-lg border hairline bg-background px-4 py-3 text-sm resize-y outline-none focus:border-foreground/30"
          />

          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-12 rounded border hairline bg-transparent cursor-pointer"
            />
            <button
              onClick={() => create.mutate()}
              disabled={!title.trim() || !message.trim() || create.isPending}
              className="ml-auto rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {create.isPending ? "Publishing..." : "Publish Announcement"}
            </button>
          </div>
        </div>
      </div>

      {/* Current Active Announcement */}
      {announcement ? (
        <div className="rounded-xl border hairline bg-surface/60 p-6">
          <h3 className="mb-4 text-lg font-semibold">Current Active Announcement</h3>
          <div
            className="rounded-lg p-5"
            style={{
              backgroundColor: (announcement.color || "#a855f7") + "20",
              borderLeft: `5px solid ${announcement.color || "#a855f7"}`,
            }}
          >
            <strong className="text-lg">{announcement.title}</strong>
            <p className="mt-2 text-sm leading-relaxed">{announcement.message}</p>
          </div>

          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="mt-4 text-red-400 hover:text-red-500 text-sm font-medium disabled:opacity-50"
          >
            {remove.isPending ? "Removing..." : "Remove Announcement"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border hairline bg-surface/60 p-8 text-center text-muted-foreground">
          No active announcement. Create one above.
        </div>
      )}
    </div>
  );
}

// ── Warns Tab ─────────────────────────────────────────────────────────────────────

function WarnsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: warns, isLoading } = useQuery({
    queryKey: ["admin", "warns"],
    queryFn: () => api.admin.warns(),
  });

  const deleteWarn = useMutation({
    mutationFn: (id: string) => api.admin.deleteWarn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "warns"] }),
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{warns?.length ?? 0} total warns</p>
      {!warns?.length && <Empty text="no warns found" />}
      {warns?.map((w) => (
        <div key={w._id} className="flex items-start justify-between gap-4 rounded-xl border hairline bg-surface/60 p-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">user: {w.userId}</span>
              <span>·</span>
              <span className="font-mono">guild: {w.guildId}</span>
              <span>·</span>
              <span>{new Date(w.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="mt-1.5 text-sm text-foreground">{w.reason}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">by {w.moderatorId}</p>
          </div>
          <button
            onClick={() => deleteWarn.mutate(w._id)}
            disabled={deleteWarn.isPending}
            className="shrink-0 rounded-lg border hairline p-2 text-muted-foreground transition-colors hover:border-red-500/30 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Appeals Tab ───────────────────────────────────────────────────────────────────

function AppealsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "denied">("pending");

  const { data: appeals, isLoading } = useQuery({
    queryKey: ["admin", "appeals", filter],
    queryFn: () => api.admin.appeals(filter === "all" ? undefined : filter),
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "deny" }) =>
      api.admin.reviewAppeal(id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "appeals"] }),
  });

  const statusColor = {
    pending: "text-yellow-400",
    approved: "text-green-400",
    denied: "text-red-400",
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["all", "pending", "approved", "denied"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === s ? "border-foreground/30 bg-foreground/10 text-foreground" : "hairline text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {!appeals?.length && <Empty text="no appeals found" />}
      {appeals?.map((a) => (
        <div key={a._id} className="rounded-xl border hairline bg-surface/60 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">user: {a.userId}</span>
                <span>·</span>
                <span className="font-mono">guild: {a.guildId}</span>
                <span>·</span>
                <span className={statusColor[a.status]}>{a.status}</span>
                <span>·</span>
                <span>{new Date(a.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="mt-1.5 text-sm text-foreground">{a.reason}</p>
              {a.reviewedBy && (
                <p className="mt-0.5 text-xs text-muted-foreground">reviewed by {a.reviewedBy}</p>
              )}
            </div>
            {a.status === "pending" && (
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => review.mutate({ id: a._id, action: "approve" })}
                  disabled={review.isPending}
                  className="rounded-lg border hairline p-2 text-muted-foreground transition-colors hover:border-green-500/30 hover:text-green-400"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => review.mutate({ id: a._id, action: "deny" })}
                  disabled={review.isPending}
                  className="rounded-lg border hairline p-2 text-muted-foreground transition-colors hover:border-red-500/30 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Guilds Tab ────────────────────────────────────────────────────────────────────

function GuildsTab() {
  const { data: guilds, isLoading } = useQuery({
    queryKey: ["admin", "guilds"],
    queryFn: () => api.admin.guilds(),
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{guilds?.length ?? 0} guilds</p>
      {!guilds?.length && <Empty text="no guilds found" />}
      <div className="grid gap-3 sm:grid-cols-2">
        {guilds?.map((g) => (
          <div key={g._id} className="rounded-xl border hairline bg-surface/60 p-4 backdrop-blur">
            <div className="font-medium text-foreground">{g.name}</div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">{g.guildId}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              joined {new Date(g.joinedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Blocked Tab ───────────────────────────────────────────────────────────────

function BlockedTab({
  qc,
  blockInput,
  setBlockInput,
  blockReason,
  setBlockReason,
}: {
  qc: ReturnType<typeof useQueryClient>;
  blockInput: string;
  setBlockInput: (v: string) => void;
  blockReason: string;
  setBlockReason: (v: string) => void;
}) {
  const { data: blocked, isLoading } = useQuery({
    queryKey: ["admin", "blocked"],
    queryFn: () => api.admin.blockedGuilds(),
  });

  const block = useMutation({
    mutationFn: ({ guildId, reason }: { guildId: string; reason?: string }) =>
      api.admin.blockGuild(guildId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blocked"] });
      setBlockInput("");
      setBlockReason("");
    },
  });

  const unblock = useMutation({
    mutationFn: (guildId: string) => api.admin.unblockGuild(guildId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "blocked"] }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border hairline bg-surface/60 p-4 backdrop-blur">
        <h3 className="mb-3 text-sm font-semibold">block a guild</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={blockInput}
            onChange={(e) => setBlockInput(e.target.value)}
            placeholder="guild ID"
            className="flex-1 rounded-lg border hairline bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
          />
          <input
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="reason (optional)"
            className="flex-1 rounded-lg border hairline bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
          />
          <button
            onClick={() => block.mutate({ guildId: blockInput, reason: blockReason || undefined })}
            disabled={!blockInput || block.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Block
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{blocked?.length ?? 0} blocked guilds</p>
      {!blocked?.length && <Empty text="no blocked guilds" />}
      {blocked?.map((b) => (
        <div key={b._id} className="flex items-center justify-between gap-4 rounded-xl border hairline bg-surface/60 p-4 backdrop-blur">
          <div>
            <div className="font-mono text-sm text-foreground">{b.guildId}</div>
            {b.reason && <div className="mt-0.5 text-xs text-muted-foreground">{b.reason}</div>}
            <div className="mt-0.5 text-xs text-muted-foreground">
              blocked {new Date(b.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => unblock.mutate(b.guildId)}
            disabled={unblock.isPending}
            className="shrink-0 rounded-lg border hairline px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-green-500/30 hover:text-green-400"
          >
            unblock
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl border hairline bg-surface/40" />
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border hairline bg-surface/60 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}