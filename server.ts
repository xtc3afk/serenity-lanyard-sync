// server.ts
import "@aikidosec/firewall";
import "dotenv/config";

import { connectDB } from "./services/db.service";
import { startStatusMonitor } from "./services/status.service";
import app from "./app";
import fs from 'fs';
import path from 'path';

const cookiesDir = path.join(process.cwd(), 'config');
const cookiesPath = path.join(cookiesDir, 'cookies.txt');

console.log("🔧 [Cookie Setup] Starting cookie configuration...");

if (process.env.COOKIES) {
    try {
        fs.mkdirSync(cookiesDir, { recursive: true });
        
        // Write secret to file
        fs.writeFileSync(cookiesPath, process.env.COOKIES, 'utf8');
        
        const size = Buffer.byteLength(process.env.COOKIES);
        console.log(`✅ [Cookie Setup] SUCCESS: YT_COOKIES secret loaded (${size} characters)`);
        console.log(`✅ [Cookie Setup] Written to: ${cookiesPath}`);
        
        // Optional: Show first few lines for debugging (without exposing full cookies)
        const preview = process.env.COOKIES.split('\n').slice(0, 3).join('\n');
        console.log(`📋 [Cookie Setup] Preview (first 3 lines):\n${preview}`);
        
    } catch (err: any) {
        console.error("❌ [Cookie Setup] FAILED to write cookies from secret:", err.message);
    }
} 
else if (fs.existsSync(cookiesPath)) {
    const stats = fs.statSync(cookiesPath);
    console.log(`✅ [Cookie Setup] Using existing cookies.txt file (${stats.size} bytes)`);
    console.log(`📍 [Cookie Setup] Path: ${cookiesPath}`);
} 
else {
    console.warn("⚠️  [Cookie Setup] NO COOKIES FOUND!");
    console.warn("   → Neither YT_COOKIES secret nor config/cookies.txt exists.");
    console.warn("   → YouTube downloads will likely fail with bot detection.");
}

async function start() {
    try {
        await connectDB();
        startStatusMonitor();
    } catch (e) {
        console.error("⚠️  Starting without PostgreSQL:", (e as Error).message);
    }

    const argPortIdx = process.argv.indexOf("--port");
    const argPort = argPortIdx !== -1 ? process.argv[argPortIdx + 1] : null;
    const PORT = argPort || process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 YouTube Proxy endpoint: /api/user/youtube-proxy`);
    });
}

start().catch(console.error);