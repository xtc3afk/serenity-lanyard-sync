import { Request, Response, NextFunction } from "express";
import { collections } from "../services/mongo.service";
import { SessionUser } from "../types";
import { ADMIN_IDS } from "../config";

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
    const sessionId = req.cookies?.session_id;
    if (!sessionId) return null;

    const session = await collections.sessions().findOne({
        sessionId,
        expiresAt: { $gt: new Date() },
    });

    if (!session) return null;

    const user = await collections.users().findOne({ discordId: session.discordId });
    if (!user) return null;

    return {
        discordId: user.discordId as string,
        username: user.username as string,
    };
}

export function requireAuth(
    handler: (req: Request, res: Response) => Promise<any>
) {
    return async (req: Request, res: Response) => {
        try {
            const user = await getSessionUser(req);
            if (!user) {
                return res.status(401).json({ success: false, error: "unauthorized" });
            }

            req.sessionUser = user;
            await handler(req, res);
        } catch (e) {
            console.error(e);
            res.status(500).json({ success: false, error: "internal error" });
        }
    };
}

export function requireAdmin(
    handler: (req: Request, res: Response) => Promise<any>
) {
    return async (req: Request, res: Response) => {
        try {
            const user = await getSessionUser(req);
            if (!user || !ADMIN_IDS.includes(user.discordId)) {
                return res.status(403).json({ success: false, error: "forbidden" });
            }

            req.sessionUser = user;
            await handler(req, res);
        } catch (e) {
            console.error(e);
            res.status(500).json({ success: false, error: "internal error" });
        }
    };
}