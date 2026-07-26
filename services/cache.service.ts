import { db } from "./db.service";

const STATS_CACHE_MS = 45_000;
let statsCache: { body: any; expiresAt: number } | null = null;

export function formatUptimePercent(uptimeMs: number, windowMs = 7 * 24 * 60 * 60 * 1000) {
    return `${Math.min(100, (uptimeMs / windowMs) * 100).toFixed(2)}%`;
}

export async function loadStats() {
    const doc = await db.query('SELECT * FROM stats WHERE _id = $1', ["dashboard" as any]);

    let users = doc?.users ?? await db.query('SELECT COUNT(*) FROM users');
    let servers = doc?.servers ?? 0;

    if (servers === 0) {
        try {
            const appl = await fetch("https://discord.com/api/v10/applications/@me", {
                headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
            }).then(r => r.json());
            servers = appl.approximate_guild_count ?? 0;
        } catch (e) {
            console.error("Failed to fetch bot guild count", e);
        }
    }

    return {
        success: true,
        servers,
        users,
        uptime: formatUptimePercent(process.uptime() * 1000)
    };
}

export async function getCachedStats() {
    if (statsCache && Date.now() < statsCache.expiresAt) {
        return statsCache.body;
    }

    const body = await loadStats();
    statsCache = { body, expiresAt: Date.now() + STATS_CACHE_MS };
    return body;
}

export function clearStatsCache() {
    statsCache = null;
}