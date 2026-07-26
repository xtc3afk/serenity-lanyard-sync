import Zen from "@aikidosec/firewall";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";

import authRouter from "./routes/auth.routes";
import userRouter from "./routes/user.routes";
import guildRouter from "./routes/guild.routes";
import adminRouter from "./routes/admin.routes";
import publicRouter from "./routes/index";
require("./jobs/rl.job");

const app = express();

// Security
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
    process.env.FRONTEND_URL,       // https://whimper.wtf
    "http://localhost:3000",
    "http://localhost:5173",         // vite default
    "http://localhost:8080",         // tanstack start default
  ].filter(Boolean) as string[];
  

// Zen Firewall
app.use((req, res, next) => {
    const sessionId = req.cookies?.session_id;
    Zen.setUser(sessionId
        ? { id: sessionId, name: "Authenticated User" }
        : { id: "anonymous", name: "Anonymous" }
    );
    next();
});

Zen.addExpressMiddleware(app);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));

// Routes
app.get("/", (_, res) => res.send("Backend is alive"));
app.use(express.static(path.join(process.cwd(), "public")));
app.get("/status", (_, res) => {
    res.sendFile(path.join(process.cwd(), "status.html"));
});

app.use("/auth", authRouter);
app.use("/api", publicRouter);
app.use("/api/user", userRouter);
app.use("/api/guilds", guildRouter);
app.use("/api/admin", adminRouter);

export default app;