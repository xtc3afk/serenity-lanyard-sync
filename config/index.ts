import dotenv from "dotenv";
dotenv.config();

export const ADMIN_IDS = [
    "1216023255878471763",
    "792653373458743306",
    "1264283141619847171"
];

export const OWNER_IDS = [...ADMIN_IDS]; // same for now

export const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL,
    "https://whimper.wtf",
    "http://localhost:3001",
].filter(Boolean) as string[];

export const PORT = process.env.PORT || 3000;