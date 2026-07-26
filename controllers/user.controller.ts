import https from "https";
import { Request, Response } from "express";
import { db } from "../services/db.service";
import { fetchDiscordGuildsForUser } from "../services/discord.service";
import { buildAvatarUrl, buildGuildIconUrl } from "../services/discord.service";
import { ADMIN_IDS } from "../config";
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execPromise = promisify(execFile);

function hasManageGuild(g: any): boolean {
    if (g.owner) return true;
    if (g.permissions == null) return false;
    try {
        return (BigInt(g.permissions) & 0x20n) === 0x20n;
    } catch {
        return false;
    }
}

// OPTIMIZED: Guild server list fetcher. Stops massive Promise.all DB spikes.
export async function getUserGuilds(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const isAdmin = ADMIN_IDS.includes(discordId);

    const botGuilds = await db.query('SELECT * FROM guilds');
    const botGuildMap = new Map(botGuilds.map((g: any) => [g.guildId, g]));

    const userDoc = await db.query('SELECT * FROM users WHERE discordId = $1', [discordId]);

    if (isAdmin) {
        const guildsWithStats = botGuilds.map((g: any) => ({
            guildId: g.guildId,
            name: g.name,
            icon: buildGuildIconUrl(g.guildId, g.icon),
            memberCount: g.memberCount ?? null,
            joinedAt: g.joinedAt,
            botPresent: true,
            stats: { warns: 0, appeals: 0, members: g.memberCount ?? 0, forcedNicks: 0 }
        }));
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

    const managedGuilds = userDiscordGuilds.filter(hasManageGuild);
    const guildsList: any[] = [];

    for (const g of managedGuilds) {
        const botGuild = botGuildMap.get(g.id);
        guildsList.push({
            guildId: g.id,
            name: g.name,
            icon: buildGuildIconUrl(g.id, g.icon),
            memberCount: g.memberCount ?? null,
            botPresent: !!botGuild,
            isBlocked: false,
            stats: { warns: 0, appeals: 0, members: 0, forcedNicks: 0 }
        });
    }

    res.json({ success: true, guilds: guildsList });
}

export async function getGuildSettings(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const { guildId } = req.params;
    const isAdmin = ADMIN_IDS.includes(discordId);

    const guild = await db.query('SELECT * FROM guilds WHERE guildId = $1', [guildId]);
    if (!guild) {
        return res.status(404).json({ success: false, error: "guild not found" });
    }

    if (!isAdmin) {
        let hasAccess = guild.ownerId === discordId;
        if (!hasAccess) {
            const userDoc = await db.query('SELECT * FROM users WHERE discordId = $1', [discordId]);
            if (userDoc?.accessToken) {
                try {
                    const userGuilds = await fetchDiscordGuildsForUser(userDoc.accessToken);
                    hasAccess = userGuilds.some((g: any) => g.id === guildId && hasManageGuild(g));
                } catch {}
            }
        }
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: "you don't manage this server" });
        }
    }

    const [automod, logs, guildSettings] = await Promise.all([
        db.query('SELECT * FROM automod WHERE guildId = $1', [guildId]),
        db.query('SELECT * FROM logChannels WHERE guildId = $1', [guildId]),
        db.query('SELECT * FROM guildSettings WHERE guildId = $1', [guildId]),
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

    const guild = await db.query('SELECT * FROM guilds WHERE guildId = $1', [guildId]);
    if (!guild) {
        return res.status(404).json({ success: false, error: "guild not found" });
    }

    if (!isAdmin) {
        let hasAccess = guild.ownerId === discordId;
        if (!hasAccess) {
            const userDoc = await db.query('SELECT * FROM users WHERE discordId = $1', [discordId]);
            if (userDoc?.accessToken) {
                try {
                    const userGuilds = await fetchDiscordGuildsForUser(userDoc.accessToken);
                    hasAccess = userGuilds.some((g: any) => g.id === guildId && hasManageGuild(g));
                } catch {}
            }
        }
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: "you don't manage this server" });
        }
    }

    if (data.automod) {
        await db.query('UPDATE automod SET $1 WHERE guildId = $2', [data.automod, guildId]);
    }
    if (data.guildSettings) {
        await db.query('UPDATE guildSettings SET $1 WHERE guildId = $2', [data.guildSettings, guildId]);
    }

    res.json({ success: true });
}

// --- NEW VALORANT LOOKUP, UPDATES, AND FETCHERS ---

export async function getRiotConnection(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const user = await db.query('SELECT * FROM users WHERE discordId = $1', [discordId]);
    res.json({ success: true, riot: user?.riotConnection ?? null });
}

export async function updateRiotRegion(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    const { region } = req.body;

    if (!region) {
        return res.status(400).json({ success: false, error: "Region is required" });
    }

    await db.query('UPDATE users SET $1 WHERE discordId = $2', [{"riotConnection": {"region" : region}}, discordId]);
    res.json({ success: true, riotConnection: {"region" : region} });
}

export async function deleteRiotConnection(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;
    await db.query('UPDATE users SET $1 WHERE discordId = $2', [{"riotConnection": ""}, discordId]);
    res.json({ success: true, riotConnection: "" });
}

// public lookups — allows lookup by Discord ID or Valorant Name#Tag
export async function lookupValorantProfile(req: Request, res: Response) {
    try {
        const { discordId, riotName, riotTag } = req.query;

        if (discordId) {
            const user = await db.query('SELECT * FROM users WHERE discordId = $1', [discordId as string]);
            if (!user || !user.riotConnection) {
                return res.json({ success: false, error: "No linked Valorant profile found for this Discord ID." });
            }
            return res.json({
                success: true,
                foundInDb: true,
                discord: {
                    username: user.username,
                    globalName: user.globalName ?? user.username,
                    avatar: buildAvatarUrl(user.discordId, user.avatar),
                    discordId: user.discordId,
                },
                riot: user.riotConnection
            });
        }

        if (riotName && riotTag) {
            const riotIdStr = `${riotName}#${riotTag}`;
            // Case-insensitive regex lookup
            const user = await db.query('SELECT * FROM users WHERE "riotConnection.name" = $1', [new RegExp("^" + riotIdStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i")]);

            if (user) {
                return res.json({
                    success: true,
                    foundInDb: true,
                    discord: {
                        username: user.username,
                        globalName: user.globalName ?? user.username,
                        avatar: buildAvatarUrl(user.discordId, user.avatar),
                        discordId: user.discordId,
                    },
                    riot: user.riotConnection
                });
            }

            // If not found in DB, return as fallback so the site can generate Tracker.gg links
            return res.json({
                success: true,
                foundInDb: false,
                riot: {
                    name: riotIdStr,
                    region: "na" // default fallback
                }
            });
        }

        return res.status(400).json({ success: false, error: "Provide either a Discord ID or Valorant Name & Tag to search." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Lookup server error" });
    }
}

export const getRocketLeagueStats = async (req, res) => {
    try {

        const stats = {
            username: "hitselecting",
            platform: "Epic",
            rank: "Grand Champion II",
            mmr: 1560,
            wins: 420,
            goals: 1300,
            assists: 600,
            saves: 800,
            updatedAt: new Date()
        };


        res.json(stats);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to fetch Rocket League stats"
        });

    }
}

export async function youtubeProxy(req: Request, res: Response) {
    try {
        const { url, format = "mp3" } = req.query;
        if (!url) {
            return res.status(400).json({ success: false, error: "Missing url parameter" });
        }

        const decodedUrl = decodeURIComponent(url as string);
        const isMp3 = String(format).toLowerCase() === "mp3";

        const cobaltUrl = "https://whimper-cobalt.fly.dev";   // ← Change if your app name is different

        const payload = {
            url: decodedUrl,
            isAudioOnly: isMp3,
            audioFormat: isMp3 ? "mp3" : undefined,
            filenameStyle: "pretty",
            // Optional but recommended
            disableMetadata: false,
        };

        console.log(`[Cobalt] Sending request:`, payload);

        const response = await fetch(`${cobaltUrl}/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const responseText = await response.text();
        let data;

        try {
            data = JSON.parse(responseText);
        } catch {
            data = { status: "error", error: responseText };
        }

        if (!response.ok || data.status === "error") {
            console.error(`[Cobalt] Error ${response.status}:`, data);
            return res.status(502).json({ 
                success: false, 
                error: data?.error?.message || data?.error || "Cobalt processing failed" 
            });
        }

        if (data.url) {
            console.log(`[Cobalt] Success → ${isMp3 ? 'MP3' : 'MP4'}`);
            return res.redirect(data.url);
        } else {
            return res.status(502).json({ success: false, error: "No download URL returned" });
        }

    } catch (error: any) {
        console.error("Cobalt proxy error:", error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: "Internal server error" });
        }
    }
}