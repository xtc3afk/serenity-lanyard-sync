export interface LanyardActivity {
    id?: string;
    name: string;
    type: number;
    state?: string;
    details?: string;
    application_id?: string;
    timestamps?: { start?: number; end?: number };
    assets?: {
        large_image?: string;
        large_text?: string;
        small_image?: string;
        small_text?: string;
    };
}

export interface LanyardUser {
    discord_user: {
        id: string;
        username: string;
        global_name?: string | null;
        avatar: string | null;
        discriminator?: string;
    };
    discord_status: "online" | "idle" | "dnd" | "offline";
    activities: LanyardActivity[];
    listening_to_spotify?: boolean;
    spotify?: {
        track_id: string;
        song: string;
        artist: string;
        album: string;
        album_art_url: string;
    } | null;
}

/**
 * Lanyard only returns users who joined https://discord.gg/lanyard.
 * Returns null on 404 so callers can fall back to the bot API.
 */
export async function fetchLanyardPresence(discordId: string): Promise<LanyardUser | null> {
    try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${discordId}`);
        if (!res.ok) return null;
        const json: any = await res.json();
        if (!json?.success || !json?.data) return null;
        return json.data as LanyardUser;
    } catch {
        return null;
    }
}