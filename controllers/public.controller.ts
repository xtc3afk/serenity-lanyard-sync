import { Request, Response } from "express";
import { collections } from "../services/mongo.service";
import { fetchDiscordUser } from "../services/discord.service";
import { buildAvatarUrl } from "../services/discord.service";
import { getCachedStats } from "../services/cache.service";
import { OWNER_IDS } from "../config";

// Per-owner display metadata
const OWNER_META: Record<string, { role: string; fallbackName: string }> = {
    "1216023255878471763": { role: "Founder & Main Dev",          fallbackName: "Founder"  },
    "1222982434803417181": { role: "Co-Owner",                    fallbackName: "Co-Owner" },
    "1264283141619847171": { role: "Co-Owner",                    fallbackName: "Co-Owner" },
    "1196538803008061520": { role: "Co-Owner · Top 100 Radiant",  fallbackName: "Co-Owner" },
    "792653373458743306":  { role: "Manager",                     fallbackName: "Manager"  },
};

export async function getOwners(req: Request, res: Response) {
    try {
        const owners = await Promise.all(
            OWNER_IDS.map(async (discordId) => {
                const meta = OWNER_META[discordId] ?? { role: "Staff", fallbackName: "Staff" };
                const user = await fetchDiscordUser(discordId);

                if (!user) {
                    return {
                        discordId,
                        username: meta.fallbackName,
                        globalName: meta.fallbackName,
                        avatar: `https://cdn.discordapp.com/embed/avatars/${
                            Number(BigInt(discordId) >> 22n) % 6
                        }.png`,
                        role: meta.role,
                    };
                }

                const ext = user.avatar?.startsWith("a_") ? "gif" : "webp";
                return {
                    discordId: user.id,
                    username: user.username,
                    globalName: user.global_name || user.username,
                    avatar: user.avatar
                        ? `https://cdn.discordapp.com/avatars/${discordId}/${user.avatar}.${ext}?size=128`
                        : `https://cdn.discordapp.com/embed/avatars/${
                            Number(BigInt(discordId) >> 22n) % 6
                          }.png`,
                    avatarHash: user.avatar,
                    role: meta.role,
                };
            })
        );

        res.json({ success: true, owners });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to fetch owners" });
    }
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

        res.json({ success: true, leaderboard: enriched });
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