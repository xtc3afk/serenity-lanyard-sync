import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import * as userController from "../controllers/user.controller";

const router = Router();

router.get("/guilds", requireAuth(userController.getUserGuilds));
router.get("/guilds/:guildId/settings", requireAuth(userController.getGuildSettings));
router.post("/guilds/:guildId/settings", requireAuth(userController.updateGuildSettings));

// --- VALORANT ACCOUNT CONNECTION & LOOKUP ---
router.get("/riot-connection", requireAuth(userController.getRiotConnection));
router.patch("/riot-region", requireAuth(userController.updateRiotRegion));
router.delete("/riot-connection", requireAuth(userController.deleteRiotConnection));

// Public search profiles
router.get("/valorant/lookup", userController.lookupValorantProfile);


// --- ROCKET LEAGUE STATS ---
router.get("/rocketleague", userController.getRocketLeagueStats);


router.get("/youtube-proxy", userController.youtubeProxy);

export default router;