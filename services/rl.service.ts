import puppeteer from "puppeteer";

const PROFILE_URL =
    "https://rocketleague.tracker.network/rocket-league/profile/epic/hitselecting/overview";

export type RocketLeagueStats = {
    username: string;
    platform: string;
    profileUrl: string;
    playlists: Array<{ playlist: string; rank: string; mmr: number | null; division?: string | null }>;
    lifetime: Record<string, number | string>;
    scrapedAt: string;
};

export async function scrapeRocketLeague(): Promise<RocketLeagueStats> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        );
        await page.goto(PROFILE_URL, { waitUntil: "networkidle2", timeout: 60_000 });

        await page.waitForSelector(".rating, .stat, .numbers", { timeout: 30_000 }).catch(() => {});

        const data = await page.evaluate(() => {
            const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
            const toNum = (s: string) => {
                const n = Number(s.replace(/[^\d.-]/g, ""));
                return Number.isFinite(n) ? n : null;
            };

            const playlists: Array<{ playlist: string; rank: string; mmr: number | null; division?: string | null }> = [];
            document.querySelectorAll(".rating").forEach((el) => {
                const playlist = clean(el.querySelector(".playlist")?.textContent);
                const rank = clean(el.querySelector(".rank__tier, .tier")?.textContent);
                const division = clean(el.querySelector(".rank__subtier, .division")?.textContent) || null;
                const mmrText = clean(el.querySelector(".mmr")?.textContent);
                if (playlist) playlists.push({ playlist, rank, division, mmr: toNum(mmrText) });
            });

            const lifetime: Record<string, number | string> = {};
            document.querySelectorAll(".stat").forEach((el) => {
                const name = clean(el.querySelector(".name")?.textContent);
                const value = clean(el.querySelector(".value")?.textContent);
                if (name) lifetime[name] = toNum(value) ?? value;
            });

            return { playlists, lifetime };
        });

        return {
            username: "hitselecting",
            platform: "epic",
            profileUrl: PROFILE_URL,
            playlists: data.playlists,
            lifetime: data.lifetime,
            scrapedAt: new Date().toISOString(),
        };
    } finally {
        await browser.close().catch(() => {});
    }
}