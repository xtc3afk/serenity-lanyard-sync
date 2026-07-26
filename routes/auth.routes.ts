import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import * as authController from "../controllers/auth.controller";

const router = Router();

router.get("/login", authController.login);
router.get("/discord", (req, res) => res.redirect("/auth/login"));
router.get("/discord/callback", authController.callback);
router.get("/user-install", authController.userInstall);

router.get("/connections-login", authController.connectionsLogin);
router.get("/connections/callback", authController.connectionsCallback);

router.get("/me", requireAuth(authController.me));
router.get("/me/guilds", requireAuth(authController.meGuilds));

router.get("/logout", requireAuth(authController.logout));
router.post("/logout", requireAuth(authController.logout));

export default router;