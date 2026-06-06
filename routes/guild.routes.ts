import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import * as guildController from "../controllers/guild.controller";
import { collections } from "../services/mongo.service";
import { fetchDiscordGuildsForUser } from "../services/discord.service";
import { ADMIN_IDS } from "../config";

const router = Router();

router.get("/:guildId/stats", requireAuth(guildController.getGuildStats));

// Shared access guard — admin OR user has MANAGE_GUILD on the guild
async function ensureGuildAccess(discordId: string, guildId: string): Promise<boolean> {
    if (ADMIN_IDS.includes(discordId)) return true;
    const userDoc = await collections.users().findOne({ discordId });
    if (!userDoc?.accessToken) return false;
    try {
        const userGuilds = await fetchDiscordGuildsForUser(userDoc.accessToken);
        const MANAGE_GUILD = 0x20n;
        const match = userGuilds.find((g: any) => g.id === guildId);
        if (!match) return false;
        if (match.owner) return true;
        if (match.permissions == null) return false;
        return (BigInt(match.permissions) & MANAGE_GUILD) === MANAGE_GUILD;
    } catch {
        return false;
    }
}

// PATCH /api/guilds/:guildId/settings
router.patch("/:guildId/settings", requireAuth(async (req, res) => {
    const { discordId } = req.sessionUser!;
    const { guildId } = req.params;

    if (!(await ensureGuildAccess(discordId, guildId))) {
        return res.status(403).json({ success: false, error: "you don't manage this server" });
    }

    const allowed = ["prefix", "logChannel", "verifiedRoleId", "welcomeChannel", "modlogChannel", "autorole"];
    const update: Record<string, any> = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k] ?? null;

    await collections.guildSettings().updateOne(
        { guildId },
        { $set: update },
        { upsert: true }
    );
    const doc = await collections.guildSettings().findOne({ guildId });
    res.json({ success: true, settings: doc });
}));

// PATCH /api/guilds/:guildId/automod
router.patch("/:guildId/automod", requireAuth(async (req, res) => {
    const { discordId } = req.sessionUser!;
    const { guildId } = req.params;

    if (!(await ensureGuildAccess(discordId, guildId))) {
        return res.status(403).json({ success: false, error: "you don't manage this server" });
    }

    const allowed = ["enabled", "toxicityEnabled", "toxicityAction", "toxicityThreshold", "raidEnabled", "logChannelId", "rules"];
    const update: Record<string, any> = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];

    await collections.automod().updateOne(
        { guildId },
        { $set: update },
        { upsert: true }
    );
    const doc = await collections.automod().findOne({ guildId });
    res.json({ success: true, automod: doc });
}));

export default router;