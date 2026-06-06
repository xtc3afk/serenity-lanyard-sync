import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Activity,
  Users,
  ShieldAlert,
  Inbox,
  Heart,
  Settings,
  Calendar,
  Save,
  Bot,
  MessageSquareWarning,
  UserCog,
  Award,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, type GuildSettings, type AutomodConfig } from "@/lib/api";
import { useMe } from "@/hooks/useMe";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard_/$guildId")({
  head: ({ params }) => ({
    meta: [
      { title: `Server ${params.guildId} - whimper ♡` },
      { name: "description", content: "All stats for this server." },
    ],
  }),
  component: GuildStatsPage,
});

function guildIconUrl(_id: string, icon?: string | null) {
  if (!icon) return null;
  if (icon.startsWith("http")) return icon;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${_id}/${icon}.${ext}?size=256`;
}

function fmt(n?: number | null) {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function GuildStatsPage() {
  const { guildId } = Route.useParams();
  const { data: meData } = useMe();
  const user = meData?.user ?? null;

  const q = useQuery({
    queryKey: ["guildStats", guildId],
    queryFn: () => api.guildStats(guildId),
    enabled: !!user,
    retry: false,
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">sign in to view this server.</p>
        <a
          href={api.loginUrl()}
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Sign in with Discord
        </a>
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="h-32 animate-pulse rounded-xl border hairline bg-surface/40" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border hairline bg-surface/40" />
          ))}
        </div>
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">couldn't load stats for this server.</p>
        <Link
          to="/dashboard"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border hairline bg-surface/60 px-4 py-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> back to dashboard
        </Link>
      </div>
    );
  }

  const s = q.data;
  const icon = guildIconUrl(s.guild.id, s.guild.icon);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> all servers
      </Link>

      <header className="mb-10 flex items-center gap-5">
        {icon ? (
          <img
            src={icon}
            alt={s.guild.name}
            className="h-20 w-20 rounded-2xl object-cover ring-1 ring-foreground/10"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border hairline bg-surface/60 text-xl font-semibold">
            {s.guild.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Server</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{s.guild.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono">{s.guild.id}</span>
            {s.guild.joinedAt && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                joined {new Date(s.guild.joinedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Stat grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Members" value={fmt(s.guild.memberCount)} />
        <Stat icon={Activity} label="Tracked users" value={fmt(s.counts.activeUsers)} />
        <Stat icon={ShieldAlert} label="Warnings" value={fmt(s.counts.warns)} />
        <Stat
          icon={Inbox}
          label="Appeals"
          value={fmt(s.counts.appeals)}
          sub={`${s.counts.appealsPending ?? 0} pending`}
        />
        <Stat icon={Award} label="Badges awarded" value={fmt(s.counts.badges)} />
        <Stat icon={UserCog} label="Forced nicks" value={fmt(s.counts.forcedNicks)} />
        <Stat icon={MessageSquareWarning} label="Confessions" value={fmt(s.counts.confessions)} />
        <Stat
          icon={Bot}
          label="Automod"
          value={s.automod?.enabled ? "On" : "Off"}
          sub={s.automod?.toxicityEnabled ? "toxicity" : undefined}
        />
      </div>

      {/* Settings + reputation */}
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <SettingsForm guildId={guildId} initial={s.settings ?? {}} />

        <div className="rounded-xl border hairline bg-surface/60 p-6 backdrop-blur">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <Heart className="h-3.5 w-3.5" /> Top reputation
          </h2>
          <p className="text-xs text-muted-foreground">members of this server</p>
          {s.topRepUsers.length === 0 ? (
            <p className="mt-6 text-xs text-muted-foreground">no rep yet.</p>
          ) : (
            <ol className="mt-4 divide-y divide-foreground/5">
              {s.topRepUsers.map((u, i) => (
                <li key={u.userId} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-center text-xs font-mono text-muted-foreground">
                    {i + 1}
                  </span>
                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt={u.username}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-foreground/10"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-background ring-1 ring-foreground/10" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {u.username}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {u.rep.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Automod */}
      <div className="mt-6">
        <AutomodPanel guildId={guildId} initial={s.automod} />
      </div>
    </div>
  );
}

function SettingsForm({
  guildId,
  initial,
}: {
  guildId: string;
  initial: GuildSettings;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<GuildSettings>(initial);

  useEffect(() => setForm(initial), [initial]);

  const mut = useMutation({
    mutationFn: (data: Partial<GuildSettings>) => api.updateGuildSettings(guildId, data),
    onSuccess: () => {
      toast.success("settings saved");
      qc.invalidateQueries({ queryKey: ["guildStats", guildId] });
    },
    onError: (e: any) => toast.error(e?.message || "couldn't save settings"),
  });

  const set = <K extends keyof GuildSettings>(k: K, v: GuildSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate(form);
      }}
      className="rounded-xl border hairline bg-surface/60 p-6 backdrop-blur"
    >
      <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
        <Settings className="h-3.5 w-3.5" /> Server settings
      </h2>
      <p className="text-xs text-muted-foreground">
        stored per-guild in MongoDB
      </p>

      <div className="mt-4 space-y-3 text-sm">
        <Field label="Prefix" value={form.prefix ?? ""} onChange={(v) => set("prefix", v)} placeholder="~" mono />
        <Field
          label="Log channel ID"
          value={form.logChannel ?? ""}
          onChange={(v) => set("logChannel", v || null)}
          placeholder="123456789012345678"
          mono
        />
        <Field
          label="Verified role ID"
          value={form.verifiedRoleId ?? ""}
          onChange={(v) => set("verifiedRoleId", v || null)}
          placeholder="123456789012345678"
          mono
        />
        <Field
          label="Welcome channel"
          value={form.welcomeChannel ?? ""}
          onChange={(v) => set("welcomeChannel", v || null)}
          mono
        />
        <Field
          label="Modlog channel"
          value={form.modlogChannel ?? ""}
          onChange={(v) => set("modlogChannel", v || null)}
          mono
        />
        <Field
          label="Autorole"
          value={form.autorole ?? ""}
          onChange={(v) => set("autorole", v || null)}
          mono
        />
      </div>

      <button
        type="submit"
        disabled={mut.isPending}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        <Save className="h-3.5 w-3.5" />
        {mut.isPending ? "saving…" : "save settings"}
      </button>
    </form>
  );
}

function AutomodPanel({
  guildId,
  initial,
}: {
  guildId: string;
  initial?: AutomodConfig;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AutomodConfig>(
    initial ?? {
      enabled: false,
      toxicityEnabled: false,
      toxicityAction: "delete",
      toxicityThreshold: "medium",
      raidEnabled: false,
      logChannelId: null,
      rules: [],
    }
  );

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const mut = useMutation({
    mutationFn: (data: Partial<AutomodConfig>) => api.updateGuildAutomod(guildId, data),
    onSuccess: () => {
      toast.success("automod updated");
      qc.invalidateQueries({ queryKey: ["guildStats", guildId] });
    },
    onError: (e: any) => toast.error(e?.message || "couldn't update automod"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate(form);
      }}
      className="rounded-xl border hairline bg-surface/60 p-6 backdrop-blur"
    >
      <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
        <Bot className="h-3.5 w-3.5" /> Automod
      </h2>
      <p className="text-xs text-muted-foreground">toxicity & raid protection</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Toggle
          label="Automod enabled"
          value={form.enabled}
          onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
        />
        <Toggle
          label="Toxicity filter"
          value={form.toxicityEnabled}
          onChange={(v) => setForm((f) => ({ ...f, toxicityEnabled: v }))}
        />
        <Toggle
          label="Raid protection"
          value={form.raidEnabled}
          onChange={(v) => setForm((f) => ({ ...f, raidEnabled: v }))}
        />
        <Select
          label="Toxicity threshold"
          value={form.toxicityThreshold}
          options={["low", "medium", "high"]}
          onChange={(v) => setForm((f) => ({ ...f, toxicityThreshold: v }))}
        />
        <Select
          label="Toxicity action"
          value={form.toxicityAction}
          options={["delete", "warn", "mute", "kick", "ban"]}
          onChange={(v) => setForm((f) => ({ ...f, toxicityAction: v }))}
        />
        <Field
          label="Automod log channel"
          value={form.logChannelId ?? ""}
          onChange={(v) => setForm((f) => ({ ...f, logChannelId: v || null }))}
          mono
        />
      </div>

      <button
        type="submit"
        disabled={mut.isPending}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        <Save className="h-3.5 w-3.5" />
        {mut.isPending ? "saving…" : "save automod"}
      </button>
    </form>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border hairline bg-surface/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {sub && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {sub}
          </span>
        )}
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 block w-full rounded-md border hairline bg-background/60 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border hairline bg-background/40 px-3 py-2 text-sm">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          value ? "bg-primary" : "bg-foreground/15"
        }`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border hairline bg-background/60 px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
