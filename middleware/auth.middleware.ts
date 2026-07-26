import { Request, Response, NextFunction } from "express";
import { db } from "../services/db.service";
import { SessionUser } from "../types";
import { ADMIN_IDS } from "../config";
import NodeCache from "node-cache";

const sessionCache = new NodeCache({
    stdTTL: 30,
    checkperiod: 15,
});

export async function getSessionUser(
    req: Request
): Promise<SessionUser | null> {
    const sessionId = req.cookies?.session_id;
    if (!sessionId) return null;

    const cached = sessionCache.get<SessionUser>(sessionId);

    if (cached) {
        return cached;
    }

    const session = await db.query('SELECT * FROM sessions WHERE sessionId = $1 AND expiresAt > $2', [sessionId, new Date()]);
    if (!session) return null;

    return session[0];
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

export function requireAuth(
    handler: (req: Request, res: Response) => Promise<any>
) {
    return async (req: Request, res: Response) => {
        try {
            const user = await getSessionUser(req);
            if (!user) {
                return res.status(401).json({ success: false, error: "unauthorized" });
            }
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ success: false, error: "internal error" });
        }
    };
}