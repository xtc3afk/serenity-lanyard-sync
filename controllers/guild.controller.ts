import { Request, Response } from "express";
import { collections } from "../services/mongo.service";
import { buildAvatarUrl, buildGuildIconUrl, fetchDiscordGuildsForUser } from "../services/discord.service";
import { ADMIN_IDS } from "../config";

export async function getGuildStats(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const { guildId } = req.params;

    const guildDoc = await collections.guilds().findOne({ guildId });
    if (!guildDoc) {
        return res.status(404).json({ success: false, error: "guild not found" });
    }

    // Admins can always access
    let hasAccess = ADMIN_IDS.includes(discordId);

    if (!hasAccess) {
        const userDoc = await collections.users().findOne({ discordId });
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
        collections.warns().countDocuments({ guildId }),
        collections.appeals().countDocuments({ guildId }),
        collections.appeals().countDocuments({ guildId, status: "pending" }),
        collections.dcUsers().countDocuments({ guildId }),
        collections.dcUsers()
            .find({ guildId })
            .sort({ reputation: -1 })
            .limit(5)
            .toArray(),
        collections.automod().findOne({ guildId }),
        collections.logChannels().findOne({ guildId }),
        collections.guildSettings().findOne({ guildId }),
        collections.forcedNicks().countDocuments({ guildId }),
        collections.blockedGuilds().findOne({ guildId }),
        collections.badgeState().countDocuments({ guildId }),
    ]);

    const topRepEnriched = await Promise.all(
        topRep.map(async (u: any) => {
            const userDoc = await collections.users().findOne({ discordId: u.userId });
            return {
                userId: u.userId,
                username: userDoc?.username ?? u.userId,
                avatar: buildAvatarUrl(u.userId, userDoc?.avatar),
                reputation: u.reputation ?? 0,
                warnings: u.warnings ?? 0,
                badges: u.badges ?? [],
            };
        })
    );

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
            modlogChannel: logChannel?.channelId ?? null,
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