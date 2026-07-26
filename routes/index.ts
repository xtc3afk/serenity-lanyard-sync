import { Router } from "express";
import * as publicController from "../controllers/public.controller";
import * as statusController from "../controllers/status.controller";
import fs from "fs";
import path from "path";
import { runRocketLeagueUpdate } from "../jobs/rl.job";

const router = Router();

router.get("/owners", publicController.getOwners);
router.get("/commands/grouped", publicController.getGroupedCommands);
router.get("/stats", publicController.getStats);
router.get("/leaderboard", publicController.getLeaderboard);
router.get("/announcement", publicController.getAnnouncement);
router.get("/status", statusController.getStatus);

const RL_CACHE = path.join(process.cwd(), "cache", "rocketleague.json");

router.get("/rocketleague", async (_req, res) => {
    try {
        if (!fs.existsSync(RL_CACHE)) {
            // Kick off a fetch but don't block — respond with pending state.
            runRocketLeagueUpdate().catch(() => {});
            return res.status(202).json({ success: false, pending: true, message: "Rocket League stats are being fetched, try again shortly." });
        }
        const raw = fs.readFileSync(RL_CACHE, "utf8");
        const data = JSON.parse(raw);
        res.set("Cache-Control", "public, max-age=600");
        res.json({ success: true, stats: data });
    } catch (e: any) {
        console.error("[rocketleague endpoint]", e);
        res.status(500).json({ success: false, error: "Failed to read Rocket League cache" });
    }
});

export default router;
