import cron from "node-cron";
import fs from "fs";
import path from "path";
import { scrapeRocketLeague } from "../services/rl.service";

const CACHE_DIR = path.join(process.cwd(), "cache");
const CACHE_FILE = path.join(CACHE_DIR, "rocketleague.json");

export async function runRocketLeagueUpdate() {
    console.log("[RocketLeague] Updating stats...");
    try {
        const data = await scrapeRocketLeague();
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 4)
        );
        console.log("[RocketLeague] Updated!");
    } catch (error) {
        console.error("[RocketLeague]", error);
    }
}

// Every 2 hours
cron.schedule("0 */2 * * *", runRocketLeagueUpdate);

// Run once on boot if cache is missing or stale (>2h)
(() => {
    try {
        const stat = fs.statSync(CACHE_FILE);
        if (Date.now() - stat.mtimeMs > 2 * 60 * 60 * 1000) runRocketLeagueUpdate();
    } catch {
        runRocketLeagueUpdate();
    }
})();