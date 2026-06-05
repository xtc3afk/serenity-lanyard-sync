import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import * as userController from "../controllers/user.controller";

const router = Router();

router.get("/guilds", requireAuth(userController.getUserGuilds));
router.get("/guilds/:guildId/settings", requireAuth(userController.getGuildSettings));
router.post("/guilds/:guildId/settings", requireAuth(userController.updateGuildSettings));

export default router;