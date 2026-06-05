import { Router } from "express";
import * as publicController from "../controllers/public.controller";
import * as statusController from "../controllers/status.controller";

const router = Router();

router.get("/owners", publicController.getOwners);
router.get("/commands/grouped", publicController.getGroupedCommands);
router.get("/stats", publicController.getStats);
router.get("/leaderboard", publicController.getLeaderboard);
router.get("/announcement", publicController.getAnnouncement);
router.get("/status", statusController.getStatus);

export default router;
