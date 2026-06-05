import { Request, Response } from "express";
import { collections } from "../services/mongo.service";
import { clearStatsCache } from "../services/cache.service";
import { ObjectId } from "mongodb";

export async function refreshStats(req: Request, res: Response) {
    try {
        const users = await collections.users().countDocuments();
        const servers = await collections.guilds().countDocuments();

        await collections.stats().updateOne(
            { _id: "dashboard" as any },
            { $set: { users, servers, updatedAt: new Date() } },
            { upsert: true }
        );

        clearStatsCache();

        res.json({ success: true, users, servers });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to refresh stats" });
    }
}

export async function syncGuilds(req: Request, res: Response) {
    try {
        const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
            headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        });

        if (!response.ok) throw new Error("Discord API error");

        const guilds: any[] = await response.json();

        await collections.guilds().bulkWrite(
            guilds.map((g: any) => ({
                updateOne: {
                    filter: { guildId: g.id },
                    update: {
                        $set: {
                            guildId: g.id,
                            name: g.name,
                            icon: g.icon,
                            memberCount: g.approximate_member_count,
                            updatedAt: new Date()
                        },
                        $setOnInsert: { joinedAt: new Date() },
                    },
                    upsert: true,
                },
            }))
        );

        res.json({ success: true, synced: guilds.length });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "sync failed" });
    }
}

export async function getAdminGuilds(req: Request, res: Response) {
    const guilds = await collections.guilds()
        .find({})
        .sort({ joinedAt: -1 })
        .toArray();

    res.json({ success: true, guilds });
}

export async function getAdminWarns(req: Request, res: Response) {
    const filter: any = {};
    if (req.query.guildId) filter.guildId = req.query.guildId;

    const warns = await collections.warns()
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();

    res.json({ success: true, warns });
}

export async function deleteWarn(req: Request, res: Response) {
    await collections.warns().deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
}

export async function getAdminAppeals(req: Request, res: Response) {
    const filter: any = {};
    if (req.query.status) filter.status = req.query.status;

    const appeals = await collections.appeals()
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

    res.json({ success: true, appeals });
}

export async function approveAppeal(req: Request, res: Response) {
    const appeal = await collections.appeals().findOne({ _id: new ObjectId(req.params.id) });
    if (!appeal) return res.status(404).json({ success: false, error: "appeal not found" });

    await collections.appeals().updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { 
            status: "approved", 
            reviewedBy: req.sessionUser!.username, 
            reviewedAt: new Date() 
        }}
    );

    if (appeal.guildId) {
        await collections.blockedGuilds().deleteOne({ guildId: appeal.guildId });
    }

    res.json({ success: true });
}

export async function denyAppeal(req: Request, res: Response) {
    await collections.appeals().updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { 
            status: "denied", 
            reviewedBy: req.sessionUser!.username, 
            reviewedAt: new Date() 
        }}
    );
    res.json({ success: true });
}

export async function getMyAppeals(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const appeals = await collections.appeals()
        .find({ userId: discordId })
        .sort({ createdAt: -1 })
        .toArray();

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

    const blocked = await collections.blockedGuilds().findOne({ guildId });
    if (!blocked) {
        return res.status(400).json({ success: false, error: "that server is not blocked" });
    }

    const existing = await collections.appeals().findOne({ 
        userId: discordId, 
        guildId, 
        status: "pending" 
    });

    if (existing) {
        return res.status(409).json({ success: false, error: "you already have a pending appeal" });
    }

    await collections.appeals().updateOne(
        { userId: discordId, guildId },
        { 
            $set: { 
                userId: discordId, 
                guildId, 
                reason: reason.slice(0, 1000), 
                status: "pending", 
                reviewedBy: null, 
                reviewedAt: null, 
                updatedAt: new Date() 
            }, 
            $setOnInsert: { createdAt: new Date() } 
        },
        { upsert: true }
    );

    res.json({ success: true });
}

export async function getBlockedGuilds(req: Request, res: Response) {
    const blocked = await collections.blockedGuilds()
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

    res.json({ success: true, blocked });
}

export async function blockGuild(req: Request, res: Response) {
    const { guildId, reason } = req.body;
    if (!guildId) return res.status(400).json({ success: false, error: "guildId required" });

    await collections.blockedGuilds().updateOne(
        { guildId },
        { $set: { guildId, reason: reason ?? null, createdAt: new Date() } },
        { upsert: true }
    );

    res.json({ success: true });
}

export async function unblockGuild(req: Request, res: Response) {
    await collections.blockedGuilds().deleteOne({ guildId: req.params.guildId });
    res.json({ success: true });
}
export async function setAnnouncement(req: Request, res: Response) {
    const { title, message, color } = req.body || {};
    if (!title || !message) {
        return res.status(400).json({ success: false, error: "title and message required" });
    }
    await collections.announcements().updateOne(
        { active: true },
        {
            $set: {
                title,
                message,
                color: color || "#3b82f6",
                updatedAt: new Date(),
                active: true,
            },
        },
        { upsert: true }
    );
    res.json({ success: true });
}

export async function deleteAnnouncement(_req: Request, res: Response) {
    await collections.announcements().deleteOne({ active: true });
    res.json({ success: true });
}
