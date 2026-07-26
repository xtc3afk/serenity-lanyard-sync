import { Request, Response } from "express";
import { getStatusPayload } from "../services/status.service";

export async function getStatus(_req: Request, res: Response) {
    try {
        const payload = await getStatusPayload();
        res.json(payload);
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: "Failed to load status" });
    }
}
