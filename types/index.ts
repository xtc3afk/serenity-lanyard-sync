import { Request } from "express";

export interface SessionUser {
    discordId: string;
    username: string;
}

declare global {
    namespace Express {
        interface Request {
            sessionUser?: SessionUser;
        }
    }
}

export interface DiscordUser {
    id: string;
    username: string;
    global_name?: string;
    avatar?: string;
}

export interface Guild {
    id: string;
    name: string;
    icon?: string;
    owner?: boolean;
    permissions?: string;
    approximate_member_count?: number;
}