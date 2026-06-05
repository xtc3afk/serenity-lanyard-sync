import "@aikidosec/firewall";
import "dotenv/config";

import { connectDB } from "./services/mongo.service";
import { startStatusMonitor } from "./services/status.service";
import app from "./app";

async function start() {
    await connectDB();
    startStatusMonitor();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

start().catch(console.error);