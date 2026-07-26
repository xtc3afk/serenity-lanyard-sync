import { Request, Response } from "express";
import { db } from "../services/db.service";
import { buildAvatarUrl, buildGuildIconUrl, fetchDiscordGuildsForUser } from "../services/discord.service";
import { ADMIN_IDS } from "../config";

export async function getGuildStats(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;    
    const { guildId } = req.params;

    const guildDoc = await db.query('SELECT * FROM guilds WHERE guildId = $1', [guildId]);
    if (!guildDoc) {
        return res.status(404).json({ success: false, error: "guild not found" });
    }

    // Admins can always access
    let hasAccess = ADMIN_IDS.includes(discordId);

    if (!hasAccess) {
        const userDoc = await db.query('SELECT * FROM users WHERE discordId = $1', [discordId]);
        if (userDoc?.accessToken) {
            try {
                const userGuilds = await fetchDiscordGuildsForUser(userDoc.accessToken!);
                const MANAGE_GUILD = 0x20n;
                const match = userGuilds.find((g: any) => g.id === guildId);

                if (match && (match.owner || (match.permissions != null && (BigInt(match.permissions) & MANAGE_GUILD) === MANAGE_GUILD))) {
                    hasAccess = true;
                }
            } catch (e) {
                console.error(e);
            }
        }
    }

    if (!hasAccess) {
        return res.status(403).json({ success: false, error: "you don't manage this server" });
    }

    const [
        totalWarns,
        totalAppeals,
        pendingAppeals,
        totalMembers,
        topRep,
        automod,
        logChannel,
        guildSettings,
        forcedNicks,
        blockedGuild,
        badgeCount,
    ] = await Promise.all([
        db.query('SELECT COUNT(*) FROM warns WHERE guildId = $1', [guildId]),
        db.query('SELECT COUNT(*) FROM appeals WHERE guildId = $1', [guildId]),
        db.query('SELECT COUNT(*) FROM appeals WHERE guildId = $1 AND status = $2', [guildId, "pending"]),
        db.query('SELECT COUNT(*) FROM dcUsers WHERE guildId = $1', [guildId]),
        db.query('SELECT * FROM dcUsers WHERE guildId = $1 ORDER BY reputation DESC LIMIT 5', [guildId]),
        db.query('SELECT * FROM automod WHERE guildId = $1', [guildId]),
        db.query('SELECT * FROM logChannels WHERE guildId = $1', [guildId]),
        db.query('SELECT * FROM guildSettings WHERE guildId = $1', [guildId]),
        db.query('SELECT COUNT(*) FROM forcedNicks WHERE guildId = $1', [guildId]),
        db.query('SELECT * FROM blockedGuilds WHERE guildId = $1', [guildId]),
        db.query('SELECT COUNT(*) FROM badgeState WHERE guildId = $1', [guildId]),
    ]);

    // Batch fetch user records to completely solve N+1 DB lookup pattern
    const userIds = topRep.map((u: any) => u.userId);
    const userDocs = await db.query('SELECT * FROM users WHERE discordId IN ($1)', [userIds]);
    const userMap = new Map(userDocs.map((u: any) => [u.discordId, u]));

    const topRepEnriched = topRep.map((u: any) => {
        const userDoc = userMap.get(u.userId);
        return {
            userId: u.userId,
            username: (userDoc as any)?.username ?? u.userId,
            avatar: buildAvatarUrl(u.userId, (userDoc as any)?.avatar ?? ''),
            reputation: u.reputation ?? 0,
            warnings: u.warnings ?? 0,
            badges: u.badges ?? [],
        };
    });

    res.json({
        success: true,
        guild: {
            id: guildId,
            name: guildDoc.name,
            icon: buildGuildIconUrl(guildId, guildDoc.icon),
            memberCount: guildDoc.memberCount ?? null,
            ownerId: guildDoc.ownerId ?? null,
            joinedAt: guildDoc.joinedAt ?? null,
        },
        counts: {
            warns: totalWarns,
            appeals: totalAppeals,
            appealsPending: pendingAppeals,
            activeUsers: totalMembers,
            forcedNicks,
            badges: badgeCount,
        },
        topRepUsers: topRepEnriched.map((u: any) => ({
            userId: u.userId,
            username: u.username,
            avatar: u.avatar,
            rep: u.reputation ?? 0,
        })),
        settings: {
            // Mapped to read the correct properties used by your bot's schema
            modlogChannel: logChannel?.logChannelId ?? logChannel?.modlogChannelId ?? null,
            prefix: guildSettings?.prefix ?? null,
            welcomeChannel: guildSettings?.welcomeChannel ?? null,
            autorole: guildSettings?.autorole ?? null,
        },
        isBlocked: !!blockedGuild,
        usage14d: Array.from({ length: 14 }, (_, i) => ({
            day: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
            uses: 0,
        })),
    });
}