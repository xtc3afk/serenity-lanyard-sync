import { collections, db } from "./mongo.service";

const CHECK_INTERVAL_MS = 60_000;
const HISTORY_MS = 30 * 24 * 60 * 60 * 1000;

export type ServiceId = "website" | "api" | "bot" | "database";

interface ServiceDef {
    id: ServiceId;
    name: string;
    description: string;
}

const SERVICES: ServiceDef[] = [
    { id: "website", name: "Website", description: "whimper.wtf frontend" },
    { id: "api", name: "API", description: "api.whimper.wtf" },
    { id: "bot", name: "Discord Bot", description: "Gateway & commands" },
    { id: "database", name: "Database", description: "MongoDB cluster" },
];

let monitorTimer: ReturnType<typeof setInterval> | null = null;
const latest = new Map<ServiceId, { ok: boolean; latencyMs: number | null; checkedAt: Date }>();

function websiteUrl() {
    return process.env.FRONTEND_URL || "https://whimper.wtf";
}

async function probeHttp(url: string, timeoutMs = 10_000): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            redirect: "follow",
            headers: { "User-Agent": "whimper-status/1.0" },
        });
        return { ok: res.ok, latencyMs: Date.now() - start };
    } catch {
        return { ok: false, latencyMs: Date.now() - start };
    } finally {
        clearTimeout(timer);
    }
}

async function checkWebsite() {
    return probeHttp(websiteUrl());
}

async function checkBot() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { ok: false, latencyMs: null as number | null };

    const start = Date.now();
    try {
        const res = await fetch("https://discord.com/api/v10/applications/@me", {
            headers: { Authorization: `Bot ${token}` },
        });
        return { ok: res.ok, latencyMs: Date.now() - start };
    } catch {
        return { ok: false, latencyMs: Date.now() - start };
    }
}

async function checkDatabase() {
    const start = Date.now();
    try {
        await db.admin().command({ ping: 1 });
        return { ok: true, latencyMs: Date.now() - start };
    } catch {
        return { ok: false, latencyMs: Date.now() - start };
    }
}

function checkApi() {
    return { ok: true, latencyMs: 0 };
}

async function recordCheck(serviceId: ServiceId, ok: boolean, latencyMs: number | null) {
    const checkedAt = new Date();
    latest.set(serviceId, { ok, latencyMs, checkedAt });

    await collections.statusChecks().insertOne({
        serviceId,
        ok,
        latencyMs,
        at: checkedAt,
    });

    const cutoff = new Date(Date.now() - HISTORY_MS);
    await collections.statusChecks().deleteMany({ at: { $lt: cutoff } });
}

async function uptimePercent(serviceId: ServiceId, windowMs: number): Promise<number | null> {
    const since = new Date(Date.now() - windowMs);
    const checks = await collections
        .statusChecks()
        .find({ serviceId, at: { $gte: since } })
        .toArray();

    if (checks.length === 0) return null;

    const up = checks.filter((c) => c.ok).length;
    return Math.round((up / checks.length) * 10000) / 100;
}

async function dailyUptime(serviceId: ServiceId, days: number) {
    const result: { date: string; uptime: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setUTCHours(0, 0, 0, 0);
        dayStart.setUTCDate(dayStart.getUTCDate() - i);

        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

        const checks = await collections
            .statusChecks()
            .find({ serviceId, at: { $gte: dayStart, $lt: dayEnd } })
            .toArray();

        const date = dayStart.toISOString().slice(0, 10);
        if (checks.length === 0) {
            result.push({ date, uptime: -1 });
            continue;
        }

        const up = checks.filter((c) => c.ok).length;
        result.push({ date, uptime: Math.round((up / checks.length) * 10000) / 100 });
    }

    return result;
}

export async function runHealthChecks() {
    const results = await Promise.all([
        checkWebsite().then((r) => ({ id: "website" as const, ...r })),
        Promise.resolve({ id: "api" as const, ...checkApi() }),
        checkBot().then((r) => ({ id: "bot" as const, ...r })),
        checkDatabase().then((r) => ({ id: "database" as const, ...r })),
    ]);

    await Promise.all(
        results.map((r) => recordCheck(r.id, r.ok, r.latencyMs))
    );
}

export async function getStatusPayload() {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    const services = await Promise.all(
        SERVICES.map(async (svc) => {
            const current = latest.get(svc.id);
            const uptime7d = await uptimePercent(svc.id, sevenDays);
            const uptime30d = await uptimePercent(svc.id, thirtyDays);
            const history7d = await dailyUptime(svc.id, 7);

            return {
                id: svc.id,
                name: svc.name,
                description: svc.description,
                status: current?.ok === false ? "down" : current?.ok ? "operational" : "unknown",
                latencyMs: current?.latencyMs ?? null,
                lastChecked: current?.checkedAt?.toISOString() ?? null,
                uptime7d,
                uptime30d,
                history7d,
            };
        })
    );

    const downCount = services.filter((s) => s.status === "down").length;
    const overall =
        downCount === 0
            ? "operational"
            : downCount === services.length
              ? "major_outage"
              : "partial_outage";

    return {
        success: true,
        overall,
        updatedAt: new Date().toISOString(),
        apiUptimeMs: Math.floor(process.uptime() * 1000),
        services,
    };
}

export function startStatusMonitor() {
    if (monitorTimer) return;

    runHealthChecks().catch((err) => console.error("Status check failed:", err));

    monitorTimer = setInterval(() => {
        runHealthChecks().catch((err) => console.error("Status check failed:", err));
    }, CHECK_INTERVAL_MS);
}
