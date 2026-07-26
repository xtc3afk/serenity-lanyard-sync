import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware";
import * as adminController from "../controllers/admin.controller";

const router = Router();

// Admin-only routes
router.post("/refresh-stats", requireAdmin(adminController.refreshStats));
router.post("/sync-guilds", requireAdmin(adminController.syncGuilds));
router.get("/guilds", requireAdmin(adminController.getAdminGuilds));
router.get("/warns", requireAdmin(adminController.getAdminWarns));
router.delete("/warns/:id", requireAdmin(adminController.deleteWarn));

router.get("/appeals", requireAdmin(adminController.getAdminAppeals));
router.post("/appeals/:id/approve", requireAdmin(adminController.approveAppeal));
router.post("/appeals/:id/deny", requireAdmin(adminController.denyAppeal));

router.get("/blocked-guilds", requireAdmin(adminController.getBlockedGuilds));
router.post("/blocked-guilds", requireAdmin(adminController.blockGuild));
router.delete("/blocked-guilds/:guildId", requireAdmin(adminController.unblockGuild));

router.post("/announcement", requireAdmin(adminController.setAnnouncement));
router.delete("/announcement", requireAdmin(adminController.deleteAnnouncement));

// User-facing appeal routes — requireAuth only, and /my must come before /:id
router.get("/appeals/my", requireAuth(adminController.getMyAppeals));
router.post("/appeals", requireAuth(adminController.createAppeal));

// Add these at the bottom with other admin routes
router.get("/apikeys", requireAdmin(adminController.getApiKeys));
router.post("/apikeys", requireAdmin(adminController.createApiKey));
router.delete("/apikeys/:id", requireAdmin(adminController.deleteApiKey));

export default router;