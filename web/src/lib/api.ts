export const API_BASE = "https://api.whimper.wtf"; // or http://localhost:3000 for dev

export type WhimperUser = {
  username: string;
  discordId: string;
  avatar: string;
  globalName?: string;
};

export type Owner = {
  discordId: string;
  username: string;
  globalName?: string;
  avatar: string;
  role?: string;
};

export type Command = {
  _id: string;
  name: string;
  description: string;
  category: string;
  usage?: string;
  color?: number;
};

export type StatsResponse = {
  success: boolean;
  servers: number;
  users: number;
  uptime: string;
};

export type LeaderboardEntry = {
  userId: string;
  username: string;
  globalName?: string;
  avatar?: string;
  rep: number;
};

export type OwnedGuild = {
  id: string;
  name: string;
  icon?: string | null; // full CDN URL from backend
  memberCount?: number | null;
  joinedAt?: string;
  isBlocked?: boolean;
  botPresent?: boolean;
  stats?: { warns: number; appeals: number; members: number; forcedNicks: number };
};

export type GuildStats = {
  guild: {
    id: string;
    name: string;
    icon?: string | null; // full URL from backend
    memberCount?: number | null;
    ownerId?: string | null;
    joinedAt?: string | null;
  };
  counts: {
    warns: number;
    appeals: number;
    appealsPending: number;
    activeUsers?: number;
    forcedNicks?: number;
    badges?: number;
    confessions?: number;
  };
  topRepUsers: {
    userId: string;
    username: string;
    avatar?: string;
    rep: number;
  }[];
  settings?: GuildSettings;
  automod?: AutomodConfig;
  channels?: { id: string; name: string; type: number }[];
  roles?: { id: string; name: string; color?: number }[];
  usage14d: { day: string; uses: number }[];
};

export type GuildSettings = {
  prefix?: string;
  logChannel?: string | null;
  verifiedRoleId?: string | null;
  welcomeChannel?: string | null;
  modlogChannel?: string | null;
  autorole?: string | null;
};

export type AutomodConfig = {
  enabled: boolean;
  toxicityEnabled: boolean;
  toxicityAction: string;
  toxicityThreshold: string;
  raidEnabled: boolean;
  logChannelId?: string | null;
  rules: { warnCount: number; windowMin: number; action: string }[];
};

// ── Admin types (MongoDB data) ────────────────────────────────────────────────

export type WarnEntry = {
  _id: string;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: string;
};

export type AppealEntry = {
  _id: string;
  userId: string;
  guildId: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

export type GuildEntry = {
  _id: string;
  guildId: string;
  name: string;
  ownerId: string;
  joinedAt: string;
};

export type BlockedGuild = {
  _id: string;
  guildId: string;
  reason?: string;
  createdAt: string;
};

export type Announcement = {
  title: string;
  message: string;
  color?: string;
  updatedAt?: string;
};

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  me: () => j<{ user: WhimperUser | null }>("/auth/me").catch(() => ({ user: null })),

  owners: () => j<{ success: boolean; owners: Owner[] }>("/api/owners")
    .then((d) => d.owners),

  commandsGrouped: () => 
    j<{ success: boolean; categories: Record<string, Command[]> }>("/api/commands/grouped")
      .then((d) => d.categories),

  stats: () => j<StatsResponse>("/api/stats").catch(() => null),

  leaderboard: (limit = 10) =>
    j<{ success: boolean; leaderboard: LeaderboardEntry[] }>(`/api/leaderboard?limit=${limit}`)
      .then((d) => d.leaderboard ?? []),

  // Backend (/api/user/guilds) returns: { success, guilds: [{ guildId, name,
  // icon (full URL), memberCount, joinedAt, isBlocked, stats, settings }] }
  // We map guildId -> id and mark botPresent=true (only bot-present guilds
  // are returned).
  myGuilds: () =>
    j<any>("/api/user/guilds").then((d) => {
      const arr: any[] = Array.isArray(d)
        ? d
        : d?.guilds ?? d?.data ?? d?.result ?? [];
      return arr.map((g) => ({
        id: g.id ?? g.guildId,
        name: g.name,
        icon: g.icon ?? null,
        memberCount: g.memberCount ?? g.stats?.members ?? null,
        joinedAt: g.joinedAt,
        isBlocked: !!g.isBlocked,
        botPresent: true,
        stats: g.stats,
      })) as OwnedGuild[];
    }),


  guildStats: (guildId: string) =>
    j<{ success: boolean } & GuildStats>(`/api/guilds/${guildId}/stats`)
      .then(({ success: _s, ...rest }) => rest as GuildStats),

  updateGuildSettings: (guildId: string, settings: Partial<GuildSettings>) =>
    j<{ success: boolean; settings: GuildSettings }>(
      `/api/guilds/${guildId}/settings`,
      {
        method: "PATCH",
        body: JSON.stringify(settings),
        headers: { "Content-Type": "application/json" },
      }
    ),

  updateGuildAutomod: (guildId: string, automod: Partial<AutomodConfig>) =>
    j<{ success: boolean; automod: AutomodConfig }>(
      `/api/guilds/${guildId}/automod`,
      {
        method: "PATCH",
        body: JSON.stringify(automod),
        headers: { "Content-Type": "application/json" },
      }
    ),


  // Public announcement (read). Returns null if none active.
  announcement: () =>
    j<{ success: boolean; announcement: Announcement | null }>("/api/announcement")
      .then((d) => d?.announcement ?? null)
      .catch(() => null),

  loginUrl: () => `${API_BASE}/auth/login`,
  logoutUrl: () => `${API_BASE}/auth/logout`,

  // Admin APIs
  admin: {
    warns: (guildId?: string) =>
      j<{ success: boolean; warns: WarnEntry[] }>(
        `/api/admin/warns${guildId ? `?guildId=${guildId}` : ""}`
      ).then((d) => d.warns),

    deleteWarn: (id: string) =>
      j(`/api/admin/warns/${id}`, { method: "DELETE" }),

    appeals: (status?: string) =>
      j<{ success: boolean; appeals: AppealEntry[] }>(
        `/api/admin/appeals${status ? `?status=${status}` : ""}`
      ).then((d) => d.appeals),

    reviewAppeal: (id: string, action: "approve" | "deny") =>
      j(`/api/admin/appeals/${id}/${action}`, { method: "POST" }),

    guilds: () =>
      j<{ success: boolean; guilds: GuildEntry[] }>("/api/admin/guilds").then((d) => d.guilds),

    blockedGuilds: () =>
      j<{ success: boolean; blocked: BlockedGuild[] }>("/api/admin/blocked-guilds")
        .then((d) => d.blocked),

    blockGuild: (guildId: string, reason?: string) =>
      j("/api/admin/blocked-guilds", {
        method: "POST",
        body: JSON.stringify({ guildId, reason }),
        headers: { "Content-Type": "application/json" },
      }),

    unblockGuild: (guildId: string) =>
      j(`/api/admin/blocked-guilds/${guildId}`, { method: "DELETE" }),

    setAnnouncement: (data: { title: string; message: string; color?: string }) =>
      j("/api/admin/announcement", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),

    deleteAnnouncement: () =>
      j("/api/admin/announcement", { method: "DELETE" }),
  },
  
};