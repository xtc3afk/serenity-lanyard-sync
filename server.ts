import "@aikidosec/firewall";
import "dotenv/config";

import { connectDB } from "./services/mongo.service";
import { startStatusMonitor } from "./services/status.service";
import app from "./app";

async function start() {
    try {
        await connectDB();
        startStatusMonitor();
    } catch (e) {
        console.error("⚠️  Starting without MongoDB:", (e as Error).message);
    }
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

start().catch(console.error);