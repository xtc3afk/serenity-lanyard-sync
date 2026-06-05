import { Request, Response } from "express";
import { collections } from "../services/mongo.service";
import { fetchDiscordGuildsForUser } from "../services/discord.service";
import { buildAvatarUrl, buildGuildIconUrl } from "../services/discord.service";
import { ADMIN_IDS } from "../config";

// Safe BigInt permission check — Discord sometimes omits permissions field
function hasManageGuild(g: any): boolean {
    if (g.owner) return true;
    if (g.permissions == null) return false;
    try {
        return (BigInt(g.permissions) & 0x20n) === 0x20n;
    } catch {
        return false;
    }
}

export async function getUserGuilds(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const isAdmin = ADMIN_IDS.includes(discordId);

    const botGuilds = await collections.guilds().find({}).toArray();
    const botGuildMap = new Map(botGuilds.map((g: any) => [g.guildId, g]));

    const userDoc = await collections.users().findOne({ discordId });

    // Admins see all guilds the bot is in
    if (isAdmin) {
        const guildsWithStats = await Promise.all(
            botGuilds.map((g: any) => enrichGuild(g, discordId))
        );
        return res.json({ success: true, guilds: guildsWithStats });
    }

    if (!userDoc?.accessToken) {
        return res.json({
            success: false,
            error: "Session expired — please log out and log in again.",
            guilds: [],
        });
    }

    let userDiscordGuilds: any[] = [];
    try {
        userDiscordGuilds = await fetchDiscordGuildsForUser(userDoc.accessToken);
    } catch (e) {
        console.error("Failed to fetch user guilds from Discord", e);
    }

    if (userDiscordGuilds.length === 0) {
        return res.json({
            success: false,
            error: "Couldn't reach Discord or your session has expired. Please log out and back in.",
            guilds: [],
        });
    }

    const managedGuildIds = userDiscordGuilds
        .filter(hasManageGuild)
        .map((g: any) => g.id);

    const ownedGuilds: any[] = [];
    for (const guildId of managedGuildIds) {
        if (botGuildMap.has(guildId)) {
            const botGuild = botGuildMap.get(guildId)!;
            // Patch ownerId if missing — we now know this user manages the guild
            if (!botGuild.ownerId) {
                await collections.guilds().updateOne(
                    { guildId },
                    { $set: { ownerId: discordId } }
                );
                botGuild.ownerId = discordId;
            }
            ownedGuilds.push(botGuild);
        }
    }

    const guildsWithStats = await Promise.all(
        ownedGuilds.map((g: any) => enrichGuild(g, discordId))
    );

    res.json({ success: true, guilds: guildsWithStats });
}

async function enrichGuild(g: any, discordId: string) {
    const guildId = g.guildId;
    const [warns, appeals, automod, logChannel, members, guildSettings, forcedNicks, blocked] =
        await Promise.all([
            collections.warns().countDocuments({ guildId }),
            collections.appeals().countDocuments({ guildId }),
            collections.automod().findOne({ guildId }),
            collections.logChannels().findOne({ guildId }),
            collections.dcUsers().countDocuments({ guildId }),
            collections.guildSettings().findOne({ guildId }),
            collections.forcedNicks().countDocuments({ guildId }),
            collections.blockedGuilds().findOne({ guildId }),
        ]);

    return {
        guildId: g.guildId,
        name: g.name,
        icon: buildGuildIconUrl(g.guildId, g.icon),
        memberCount: g.memberCount ?? null,
        joinedAt: g.joinedAt,
        isBlocked: !!blocked,
        stats: { warns, appeals, members, forcedNicks },
        settings: { automod, logChannel, guildSettings },
    };
}

export async function getGuildSettings(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const { guildId } = req.params;
    const isAdmin = ADMIN_IDS.includes(discordId);

    // Fetch guild from DB
    const guild = await collections.guilds().findOne({ guildId });
    if (!guild) {
        return res.status(404).json({ success: false, error: "guild not found" });
    }

    // Admins always have access
    if (!isAdmin) {
        // Check if ownerId matches, or verify live from Discord
        let hasAccess = guild.ownerId === discordId;

        if (!hasAccess) {
            const userDoc = await collections.users().findOne({ discordId });
            if (userDoc?.accessToken) {
                try {
                    const userGuilds = await fetchDiscordGuildsForUser(userDoc.accessToken);
                    hasAccess = userGuilds.some(
                        (g: any) => g.id === guildId && hasManageGuild(g)
                    );
                } catch {}
            }
        }

        if (!hasAccess) {
            return res.status(403).json({ success: false, error: "you don't manage this server" });
        }
    }

    const [automod, logs, guildSettings] = await Promise.all([
        collections.automod().findOne({ guildId }),
        collections.logChannels().findOne({ guildId }),
        collections.guildSettings().findOne({ guildId }),
    ]);

    res.json({
        success: true,
        settings: { guildId, name: guild.name, automod, logs, guildSettings }
    });
}

export async function updateGuildSettings(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const { guildId } = req.params;
    const data = req.body;
    const isAdmin = ADMIN_IDS.includes(discordId);

    const guild = await collections.guilds().findOne({ guildId });
    if (!guild) {
        return res.status(404).json({ success: false, error: "guild not found" });
    }

    if (!isAdmin) {
        let hasAccess = guild.ownerId === discordId;

        if (!hasAccess) {
            const userDoc = await collections.users().findOne({ discordId });
            if (userDoc?.accessToken) {
                try {
                    const userGuilds = await fetchDiscordGuildsForUser(userDoc.accessToken);
                    hasAccess = userGuilds.some(
                        (g: any) => g.id === guildId && hasManageGuild(g)
                    );
                } catch {}
            }
        }

        if (!hasAccess) {
            return res.status(403).json({ success: false, error: "you don't manage this server" });
        }
    }

    if (data.automod) {
        await collections.automod().updateOne(
            { guildId },
            { $set: data.automod },
            { upsert: true }
        );
    }

    if (data.guildSettings) {
        await collections.guildSettings().updateOne(
            { guildId },
            { $set: data.guildSettings },
            { upsert: true }
        );
    }

    res.json({ success: true });
}