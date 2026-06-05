import { MongoClient, Db } from "mongodb";

let client: MongoClient;

export let db: Db;

export async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error("MONGO_URI is not set. Add it to your .env file.");
    }

    client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10_000,
    });

    try {
        await client.connect();
    } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.syscall === "querySrv") {
            throw new Error(
                "Could not resolve your MongoDB Atlas host (DNS SRV lookup failed). " +
                "In Atlas: Connect → Drivers → choose a standard connection string (mongodb://…, not mongodb+srv://), " +
                "or fix DNS (e.g. use 8.8.8.8 / 1.1.1.1, disable VPN). Original: " +
                error.message
            );
        }
        throw err;
    }

    db = client.db("serenity");
    console.log("✅ MongoDB connected");
}

export const collections = {
    users: () => db.collection("users"),
    sessions: () => db.collection("sessions"),
    guilds: () => db.collection("guilds"),
    commands: () => db.collection("commands"),
    stats: () => db.collection("stats"),
    reputation: () => db.collection("reputations"),
    warns: () => db.collection("warns"),
    appeals: () => db.collection("appeals"),
    automod: () => db.collection("automods"),          // was "automod"
    logChannels: () => db.collection("logchannels"),   // was "logChannels"
    guildSettings: () => db.collection("globalsettings"), // was "guildSettings"
    dcUsers: () => db.collection("dcusers"),           // was "dcUsers"
    forcedNicks: () => db.collection("forcednicks"),   // was "forcedNicks"
    blockedGuilds: () => db.collection("blockedGuilds"),
    badgeState: () => db.collection("badgestates"),    // was "badgeState"
    announcements: () => db.collection("announcements"),
    statusChecks: () => db.collection("statusChecks"),
    confessions: () => db.collection("confessions"),   // added (exists in DB)
};