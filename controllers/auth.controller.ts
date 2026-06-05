import { Request, Response } from "express";
import crypto from "crypto";
import { collections } from "../services/mongo.service";
import { buildGuildIconUrl, fetchDiscordGuildsForUser } from "../services/discord.service";
import { buildAvatarUrl } from "../services/discord.service";
import { getSessionUser } from "../middleware/auth.middleware";

export async function login(req: Request, res: Response) {
    const state = crypto.randomBytes(16).toString("hex");
    res.cookie("oauth_state", state, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 10 * 60 * 1000
    });

    res.redirect(
        `https://discord.com/api/oauth2/authorize?` +
        `client_id=${process.env.DISCORD_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI!)}` +
        `&response_type=code` +
        `&scope=identify%20guilds` +
        `&state=${state}`
    );
}

export async function callback(req: Request, res: Response) {
    try {
        const { code, state } = req.query;
        if (!code) return res.status(400).send("No code");
        if (req.cookies?.oauth_state !== state) return res.status(403).send("Invalid state");

        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID!,
                client_secret: process.env.DISCORD_CLIENT_SECRET!,
                grant_type: "authorization_code",
                code: code as string,
                redirect_uri: process.env.DISCORD_REDIRECT_URI!,
            }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) return res.status(400).json(tokenData);

        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userRes.json();
        if (!userRes.ok) return res.status(400).json(discordUser);

        await collections.users().updateOne(
            { discordId: discordUser.id },
            {
                $set: {
                    discordId: discordUser.id,
                    username: discordUser.username,
                    globalName: discordUser.global_name ?? discordUser.username,
                    avatar: discordUser.avatar,
                    accessToken: tokenData.access_token,
                    updatedAt: new Date(),
                },
            },
            { upsert: true }
        );

        const sessionId = crypto.randomBytes(32).toString("hex");
        await collections.sessions().insertOne({
            sessionId,
            discordId: discordUser.id,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        res.cookie("session_id", sessionId, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.clearCookie("oauth_state");
        res.redirect(process.env.FRONTEND_URL!);
    } catch (e) {
        console.error(e);
        res.status(500).send("Login failed");
    }
}

export async function me(req: Request, res: Response) {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) return res.json({ user: null });

    const userDoc = await collections.users().findOne({ discordId: sessionUser.discordId });
    if (!userDoc) return res.json({ user: null });

    res.json({
        user: {
            id: userDoc.discordId,
            discordId: userDoc.discordId,
            username: userDoc.username,
            globalName: userDoc.globalName ?? userDoc.username,
            avatar: buildAvatarUrl(userDoc.discordId, userDoc.avatar),
            avatarHash: userDoc.avatar,
        },
    });
}

export async function meGuilds(req: Request, res: Response) {
    const { discordId } = req.sessionUser!;

    const userDoc = await collections.users().findOne({ discordId });
    if (!userDoc?.accessToken) {
        return res.status(400).json({
            success: false,
            error: "no access token — user must re-login with guilds scope"
        });
    }

    const discordGuilds = await fetchDiscordGuildsForUser(userDoc.accessToken);

    const botGuildIds = new Set(
        (await collections.guilds().find({}, { projection: { guildId: 1 } }).toArray())
            .map((g: any) => g.guildId)
    );

    const guilds = discordGuilds.map((g: any) => ({
        id: g.id,
        name: g.name,
        icon: buildGuildIconUrl(g.id, g.icon), // Note: function is in discord.service
        owner: g.owner as boolean,
        permissions: g.permissions,
        memberCount: g.approximate_member_count ?? null,
        botPresent: botGuildIds.has(g.id),
    }));

    res.json({ success: true, guilds });
}

export async function logout(req: Request, res: Response) {
    const sessionId = req.cookies?.session_id;
    if (sessionId) {
        await collections.sessions().deleteOne({ sessionId });
    }
    res.clearCookie("session_id");

    if (req.method === "GET") {
        res.redirect(process.env.FRONTEND_URL!);
    } else {
        res.json({ success: true });
    }
}