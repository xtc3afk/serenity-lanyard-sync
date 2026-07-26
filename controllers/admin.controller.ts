import { Request, Response } from "express";
import { db } from "../services/db.service";
import { clearStatsCache } from "../services/cache.service";
import crypto from "crypto";

export async function refreshStats(req: Request, res: Response) {
    try {
        const users = await db.query('SELECT COUNT(*) FROM users');
        const servers = await db.query('SELECT COUNT(*) FROM guilds');

        await db.query('UPDATE stats SET users = $1, servers = $2, updatedAt = $3 WHERE _id = $4', [users, servers, new Date(), "dashboard"]);

        clearStatsCache();

        res.json({ success: true, users, servers });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to refresh stats" });
    }
}

export async function syncGuilds(req: Request, res: Response) {
        const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        });

        if (!response.ok) throw new Error("Discord API error");

        const guilds: any[] = await response.json();

        guilds.forEach(async (guild: any) => {
        await db.query('INSERT INTO guilds (guildId, name, icon, memberCount, joinedAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6)', [guild.id, guild.name, guild.icon, guild.approximate_member_count, new Date(), new Date()]);
    });

    res.json({ success: true, synced: guilds.length });
}

export async function getAdminGuilds(req: Request, res: Response) {
    const guilds = await db.query('SELECT * FROM guilds ORDER BY joinedAt DESC');
    res.json({ success: true, guilds });
}
export async function getAdminWarns(req: Request, res: Response) {
    const filter: any = {};
    if (req.query.guildId) filter.guildId = req.query.guildId;
    const warns = await db.query('SELECT * FROM warns WHERE guildId = $1 ORDER BY createdAt DESC LIMIT 200', [filter.guildId]);
    res.json({ success: true, warns });
}

export async function deleteWarn(req: Request, res: Response) {
    await db.query('DELETE FROM warns WHERE id = $1', [req.params.id]);
    res.json({ success: true });
}

export async function getAdminAppeals(req: Request, res: Response) {
    const filter: any = {};
    if (req.query.status) filter.status = req.query.status;

    const appeals = await db.query('SELECT * FROM appeals WHERE status = $1 ORDER BY createdAt DESC LIMIT 100', [filter.status]);

    res.json({ success: true, appeals });
}

export async function approveAppeal(req: Request, res: Response) {
    const appeal = await db.query('SELECT * FROM appeals WHERE id = $1', [req.params.id]);
    if (!appeal) return res.status(404).json({ success: false, error: "appeal not found" });

    await db.query('UPDATE appeals SET status = $1, reviewedBy = $2, reviewedAt = $3 WHERE id = $4', ["approved", req.sessionUser!.username, new Date(), req.params.id]);

    if (appeal.guildId) {
        await db.query('DELETE FROM blockedGuilds WHERE guildId = $1', [appeal.guildId]);
    }

    res.json({ success: true });
}

export async function denyAppeal(req: Request, res: Response) {
    await db.query('UPDATE appeals SET status = $1, reviewedBy = $2, reviewedAt = $3 WHERE id = $4', ["denied", req.sessionUser!.username, new Date(), req.params.id]);
    res.json({ success: true });
}

export async function getMyAppeals(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const appeals = await db.query('SELECT * FROM appeals WHERE user_id = $1 ORDER BY createdAt DESC', [discordId]);

    res.json({ success: true, appeals });
}

export async function createAppeal(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const { guildId, reason } = req.body;

    if (!guildId || !reason) {
        return res.status(400).json({ success: false, error: "guildId and reason are required" });
    }

    if (!/^\d{17,20}$/.test(guildId)) {
        return res.status(400).json({ success: false, error: "invalid guild id" });
    }

    const blocked = await db.query('SELECT * FROM blockedGuilds WHERE guildId = $1', [guildId]);
    if (!blocked) {
        return res.status(400).json({ success: false, error: "that server is not blocked" });
    }

    const existing = await db.query('SELECT * FROM appeals WHERE userId = $1 AND guildId = $2 AND status = $3', [discordId, guildId, "pending"]);

    if (existing) {
        return res.status(409).json({ success: false, error: "you already have a pending appeal" });
    }

    await db.query('INSERT INTO appeals (userId, guildId, reason, status, reviewedBy, reviewedAt, updatedAt, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [discordId, guildId, reason.slice(0, 1000), "pending", null, null, new Date(), new Date()]);

    res.json({ success: true });
}

export async function getBlockedGuilds(req: Request, res: Response) {
    const blocked = await db.query('SELECT * FROM blockedGuilds ORDER BY createdAt DESC');

    res.json({ success: true, blocked });
}

export async function blockGuild(req: Request, res: Response) {
    const { guildId, reason } = req.body;
    if (!guildId) return res.status(400).json({ success: false, error: "guildId required" });

    await db.query('INSERT INTO blockedGuilds (guildId, reason, createdAt) VALUES ($1, $2, $3)', [guildId, reason, new Date()]);
    res.json({ success: true });
}

export async function unblockGuild(req: Request, res: Response) {
    await db.query('DELETE FROM blockedGuilds WHERE guildId = $1', [req.params.guildId]);
    res.json({ success: true });
}
export async function setAnnouncement(req: Request, res: Response) {
    const { title, message, color } = req.body || {};
    if (!title || !message) {
        return res.status(400).json({ success: false, error: "title and message required" });
    }
    await db.query('INSERT INTO announcements (title, message, color, updatedAt, active) VALUES ($1, $2, $3, $4, $5)', [title, message, color || "#3b82f6", new Date(), true]);
    res.json({ success: true });
}

export async function deleteAnnouncement(_req: Request, res: Response) {
    await db.query('DELETE FROM announcements WHERE active = true');
    res.json({ success: true });
}

// ==================== API KEYS ====================

export async function getApiKeys(req: Request, res: Response) {
    try {
        const keys = await db.query('SELECT * FROM apikeys ORDER BY createdAt DESC');
        res.json({ success: true, keys });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to fetch API keys" });
    }
}

export async function createApiKey(req: Request, res: Response) {
    try {
        const { name } = req.body;
        if (!name || typeof name !== "string" || name.trim().length < 3) {
            return res.status(400).json({ success: false, error: "Name must be at least 3 characters" });
        }

        const key = "cobalt_" + crypto.randomBytes(24).toString("hex");

        await db.query('INSERT INTO apikeys (name, key, createdBy, createdAt) VALUES ($1, $2, $3, $4)', [name.trim(), key, req.sessionUser!.discordId, new Date()]);
        res.json({ success: true, key });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to create API key" });
    }
}

export async function deleteApiKey(req: Request, res: Response) {
    try {
        await db.query('DELETE FROM apikeys WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to delete API key" });
    }
}