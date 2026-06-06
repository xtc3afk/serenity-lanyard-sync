import { Request, Response } from "express";
import { collections } from "../services/mongo.service";
import { fetchDiscordUser } from "../services/discord.service";
import { buildAvatarUrl } from "../services/discord.service";
import { getCachedStats } from "../services/cache.service";
import { fetchLanyardPresence } from "../services/lanyard.service";
import { OWNER_IDS } from "../config";

// Per-owner display metadata
const OWNER_META: Record<string, { role: string; fallbackName: string }> = {
    "1216023255878471763": { role: "Founder & Main Dev",          fallbackName: "Founder"  },
    "1222982434803417181": { role: "Co-Owner",                    fallbackName: "Co-Owner" },
    "1264283141619847171": { role: "Co-Owner",                    fallbackName: "Co-Owner" },
    "1196538803008061520": { role: "Co-Owner · Top 100 Radiant",  fallbackName: "Co-Owner" },
    "792653373458743306":  { role: "Manager",                     fallbackName: "Manager"  },
};

// Cache the whole owners response for 60s so we don't hammer Lanyard/Discord/Mongo on every visit.
const OWNERS_CACHE_MS = 60_000;
let ownersCache: { body: any; expiresAt: number } | null = null;

const LEADERBOARD_CACHE_MS = 45_000;
const leaderboardCache = new Map<number, { body: any; expiresAt: number }>();

const OWNERS_CACHE_MS_USER = 24 * 60 * 60 * 1000; // 24h — cached Discord user lookups

async function resolveOwner(discordId: string) {
    const meta = OWNER_META[discordId] ?? { role: "Staff", fallbackName: "Staff" };

    // 1) Lanyard first — gives live presence + identity without bot token.
    const lan = await fetchLanyardPresence(discordId);
    if (lan?.discord_user) {
        const u = lan.discord_user;
        // Persist identity to mongo so leaderboard / future calls have it.
        await collections.users().updateOne(
            { discordId: u.id },
            { $set: { discordId: u.id, username: u.username, globalName: u.global_name ?? u.username, avatar: u.avatar, updatedAt: new Date() } },
            { upsert: true }
        ).catch(() => {});
        return {
            discordId: u.id,
            username: u.username,
            globalName: u.global_name || u.username,
            avatar: buildOwnerAvatar(u.id, u.avatar),
            avatarHash: u.avatar,
            role: meta.role,
            status: lan.discord_status,
            activities: lan.activities ?? [],
            spotify: lan.spotify ?? null,
        };
    }

    // 2) Cached Mongo user doc (populated by previous Lanyard/Discord hits, leaderboard, OAuth login).
    const cached = await collections.users().findOne({ discordId }).catch(() => null);
    const cachedFresh = cached?.updatedAt && (Date.now() - new Date(cached.updatedAt).getTime() < OWNERS_CACHE_MS_USER);
    if (cached?.username && cachedFresh) {
        return {
            discordId,
            username: cached.username,
            globalName: cached.globalName || cached.username,
            avatar: buildOwnerAvatar(discordId, cached.avatar ?? null),
            avatarHash: cached.avatar ?? null,
            role: meta.role,
            status: "offline" as const,
            activities: [],
            spotify: null,
        };
    }

    // 3) Discord bot API (requires DISCORD_BOT_TOKEN).
    if (process.env.DISCORD_BOT_TOKEN) {
        const user = await fetchDiscordUser(discordId).catch(() => null);
        if (user) {
            await collections.users().updateOne(
                { discordId: user.id },
                { $set: { discordId: user.id, username: user.username, globalName: user.global_name ?? user.username, avatar: user.avatar ?? null, updatedAt: new Date() } },
                { upsert: true }
            ).catch(() => {});
            return {
                discordId: user.id,
                username: user.username,
                globalName: user.global_name || user.username,
                avatar: buildOwnerAvatar(discordId, user.avatar ?? null),
                avatarHash: user.avatar ?? null,
                role: meta.role,
                status: "offline" as const,
                activities: [],
                spotify: null,
            };
        }
    } else {
        console.warn("[owners] DISCORD_BOT_TOKEN not set — falling back to stale/placeholder for", discordId);
    }

    // 4) Stale mongo cache (any age) is still better than a placeholder.
    if (cached?.username) {
        return {
            discordId,
            username: cached.username,
            globalName: cached.globalName || cached.username,
            avatar: buildOwnerAvatar(discordId, cached.avatar ?? null),
            avatarHash: cached.avatar ?? null,
            role: meta.role,
            status: "offline" as const,
            activities: [],
            spotify: null,
        };
    }

    // 5) Last resort — static.
    return {
        discordId,
        username: meta.fallbackName,
        globalName: meta.fallbackName,
        avatar: defaultEmbedAvatar(discordId),
        avatarHash: null,
        role: meta.role,
        status: "offline" as const,
        activities: [],
        spotify: null,
    };
}

export async function getOwners(req: Request, res: Response) {
    try {
        if (ownersCache && Date.now() < ownersCache.expiresAt) {
            return res.json(ownersCache.body);
        }
        const owners = await Promise.all(OWNER_IDS.map(resolveOwner));
        const body = { success: true, owners };
        ownersCache = { body, expiresAt: Date.now() + OWNERS_CACHE_MS };
        res.set("Cache-Control", "public, max-age=60");
        res.json(body);
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to fetch owners" });
    }
}

function defaultEmbedAvatar(discordId: string): string {
    const idx = Number(BigInt(discordId) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

function buildOwnerAvatar(discordId: string, avatarHash: string | null | undefined): string {
    if (!avatarHash) return defaultEmbedAvatar(discordId);
    const ext = avatarHash.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=128`;
}

export async function getGroupedCommands(req: Request, res: Response) {
    try {
        const commands = await collections.commands().find({}).toArray();
        const grouped = commands.reduce((acc: any, cmd: any) => {
            if (!acc[cmd.category]) acc[cmd.category] = [];
            acc[cmd.category].push(cmd);
            return acc;
        }, {});

        res.json({ success: true, categories: grouped });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to fetch commands" });
    }
}

export async function getStats(req: Request, res: Response) {
    try {
        const body = await getCachedStats();
        res.json(body);
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to load stats" });
    }
}

export async function getLeaderboard(req: Request, res: Response) {
    try {
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));

        const hit = leaderboardCache.get(limit);
        if (hit && Date.now() < hit.expiresAt) {
            res.set("Cache-Control", "public, max-age=45");
            return res.json(hit.body);
        }

        const topRep = await collections.reputation()
            .find({})
            .sort({ reputation: -1 })
            .limit(limit)
            .toArray();

        const enriched = await Promise.all(
            topRep.map(async (r: any) => {
                let username = r.userId;
                let globalName = r.userId;
                let avatarHash: string | null = null;

                const userDoc = await collections.users().findOne({ discordId: r.userId });

                if (userDoc?.username) {
                    username = userDoc.username;
                    globalName = userDoc.globalName ?? userDoc.username;
                    avatarHash = userDoc.avatar ?? null;
                } else {
                    try {
                        const discordUser = await fetchDiscordUser(r.userId);
                        if (discordUser) {
                            username = discordUser.username;
                            globalName = discordUser.global_name ?? discordUser.username;
                            avatarHash = discordUser.avatar ?? null;

                            await collections.users().updateOne(
                                { discordId: r.userId },
                                { $set: { discordId: r.userId, username, globalName, avatar: avatarHash, updatedAt: new Date() } },
                                { upsert: true }
                            );
                        }
                    } catch {}
                }

                return {
                    userId: r.userId,
                    username,
                    globalName,
                    avatar: buildAvatarUrl(r.userId, avatarHash),
                    rep: r.reputation ?? 0,
                };
            })
        );

        const body = { success: true, leaderboard: enriched };
        leaderboardCache.set(limit, { body, expiresAt: Date.now() + LEADERBOARD_CACHE_MS });
        res.set("Cache-Control", "public, max-age=45");
        res.json(body);
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to fetch leaderboard" });
    }
}

export async function getAnnouncement(_req: Request, res: Response) {
    try {
        const announcement = await collections.announcements().findOne({ active: true });
        res.json({ success: true, announcement: announcement || null });
    } catch (e) {
        res.json({ success: true, announcement: null });
    }
}