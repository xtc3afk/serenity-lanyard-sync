const API = "/api/status";

const OVERALL_LABELS = {
    operational: "All systems operational",
    partial_outage: "Partial outage",
    major_outage: "Major outage",
    unknown: "Checking…",
};

function formatUptime(pct) {
    if (pct == null) return "—";
    return `${pct.toFixed(2)}%`;
}

function formatLatency(ms) {
    if (ms == null) return "—";
    if (ms === 0) return "<1ms";
    return `${ms}ms`;
}

function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function setOverall(overall) {
    const badge = document.getElementById("overall-badge");
    badge.textContent = OVERALL_LABELS[overall] || overall;
    badge.className = `badge badge-${overall}`;
}

function renderBars(history) {
    if (!history?.length) {
        return '<div class="bars"></div><div class="bar-labels"><span>no data yet</span></div>';
    }

    const bars = history
        .map((day) => {
            let cls = "empty";
            let height = 8;
            if (day.uptime >= 0) {
                height = Math.max(8, Math.round(day.uptime));
                cls = day.uptime >= 99 ? "up" : day.uptime >= 95 ? "partial" : "down";
            }
            return `<div class="bar ${cls}" style="height:${height}%" title="${day.date}: ${day.uptime >= 0 ? day.uptime + "%" : "no data"}"></div>`;
        })
        .join("");

    const first = history[0]?.date?.slice(5) || "";
    const last = history[history.length - 1]?.date?.slice(5) || "";

    return `<div class="bars">${bars}</div><div class="bar-labels"><span>${first}</span><span>7 days</span><span>${last}</span></div>`;
}

function renderService(svc) {
    const statusLabel =
        svc.status === "operational" ? "Operational" :
        svc.status === "down" ? "Down" : "Unknown";

    return `
        <article class="service-card">
            <div class="service-top">
                <div>
                    <h2>${svc.name}</h2>
                    <p>${svc.description}</p>
                </div>
                <span class="status-pill ${svc.status}">${statusLabel}</span>
            </div>
            <div class="metrics">
                <div class="metric">
                    <span class="label">Latency</span>
                    <span class="val">${formatLatency(svc.latencyMs)}</span>
                </div>
                <div class="metric">
                    <span class="label">7d uptime</span>
                    <span class="val">${formatUptime(svc.uptime7d)}</span>
                </div>
                <div class="metric">
                    <span class="label">30d uptime</span>
                    <span class="val">${formatUptime(svc.uptime30d)}</span>
                </div>
            </div>
            ${renderBars(svc.history7d)}
        </article>
    `;
}

function renderSummary(data) {
    const online = data.services.filter((s) => s.status === "operational").length;
    const total = data.services.length;

    const uptimes = data.services
        .map((s) => s.uptime7d)
        .filter((u) => u != null);
    const avg7d = uptimes.length
        ? uptimes.reduce((a, b) => a + b, 0) / uptimes.length
        : null;

    document.getElementById("avg-uptime-7d").textContent = formatUptime(avg7d);
    document.getElementById("services-online").textContent = `${online}/${total}`;
    document.getElementById("api-uptime").textContent = formatDuration(data.apiUptimeMs);
}

async function loadStatus() {
    try {
        const res = await fetch(API, { cache: "no-store" });
        if (!res.ok) throw new Error("bad response");

        const data = await res.json();
        setOverall(data.overall);

        const updated = data.updatedAt
            ? new Date(data.updatedAt).toLocaleString()
            : "—";
        document.getElementById("updated-at").textContent = updated;

        renderSummary(data);
        document.getElementById("services").innerHTML =
            data.services.map(renderService).join("");
    } catch {
        setOverall("major_outage");
        document.getElementById("services").innerHTML =
            '<p class="loading">could not reach the status API.</p>';
    }
}

loadStatus();
setInterval(loadStatus, 30_000);
