import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import * as guildController from "../controllers/guild.controller";

const router = Router();

router.get("/:guildId/stats", requireAuth(guildController.getGuildStats));

// PATCH /api/guilds/:guildId/settings
router.patch("/api/guilds/:guildId/settings", requireOwner, async (req, res) => {
    const allowed = ["prefix","logChannel","verifiedRoleId","welcomeChannel","modlogChannel","autorole"];
    const update: Record<string, any> = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k] || null;
  
    const doc = await GuildSettings.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: update },
      { upsert: true, new: true }
    );
    invalidateGuildSettings(req.params.guildId);
    res.json({ success: true, settings: doc });
  });
  
  // PATCH /api/guilds/:guildId/automod
  router.patch("/api/guilds/:guildId/automod", requireOwner, async (req, res) => {
    const allowed = ["enabled","toxicityEnabled","toxicityAction","toxicityThreshold","raidEnabled","logChannelId","rules"];
    const update: Record<string, any> = {};
    for (const k of allowed) if (k in req.body) update[k] = req.body[k];
  
    const doc = await Automod.findOneAndUpdate(
      { guildId: req.params.guildId },
      { $set: update },
      { upsert: true, new: true }
    );
    res.json({ success: true, automod: doc });
  });
  

export default router;