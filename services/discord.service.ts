import { DiscordUser, Guild } from "../types";

export async function fetchDiscordUser(discordId: string): Promise<DiscordUser | null> {
    const res = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    });
    if (!res.ok) return null;
    return res.json();
}

export async function fetchDiscordGuildsForUser(accessToken: string): Promise<Guild[]> {
    const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    return res.json();
}

export function buildAvatarUrl(discordId: string, avatar: string | null | undefined): string {
    if (!avatar) {
        const idx = (parseInt(discordId) >> 22) % 6;
        return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
    }
    const ext = avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${ext}`;
}

export function buildGuildIconUrl(guildId: string, icon: string | null | undefined): string | null {
    if (!icon) return null;
    const ext = icon.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=128`;
}