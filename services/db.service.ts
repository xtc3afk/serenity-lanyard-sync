// services/db.service.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function connectDB() {
    try {
        const client = await pool.connect();
        console.log('✅ PostgreSQL connected');
        client.release();

        // Ensure tables exist
        await initTables();
    } catch (err: any) {
        console.error('❌ PostgreSQL connection failed:', err.message);
        throw err;
    }
}

async function initTables() {
    const queries = [
        // Users
        `CREATE TABLE IF NOT EXISTS users (
            discord_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            global_name TEXT,
            avatar TEXT,
            access_token TEXT,
            riot_connection JSONB,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,

        // Sessions
        `CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            discord_id TEXT REFERENCES users(discord_id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        );`,

        // Stats
        `CREATE TABLE IF NOT EXISTS stats (
            id TEXT PRIMARY KEY DEFAULT 'dashboard',
            users INTEGER DEFAULT 0,
            servers INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,

        // Announcements
        `CREATE TABLE IF NOT EXISTS announcements (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            color TEXT DEFAULT '#3b82f6',
            active BOOLEAN DEFAULT true,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,

        // API Keys
        `CREATE TABLE IF NOT EXISTS apikeys (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            key TEXT UNIQUE NOT NULL,
            created_by TEXT REFERENCES users(discord_id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,

        // Status Checks
        `CREATE TABLE IF NOT EXISTS status_checks (
            id SERIAL PRIMARY KEY,
            service_id TEXT NOT NULL,
            ok BOOLEAN NOT NULL,
            latency_ms INTEGER,
            at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,

        // Indexes for performance
        `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);`,
        `CREATE INDEX IF NOT EXISTS idx_status_checks_at ON status_checks(at);`,
        `CREATE INDEX IF NOT EXISTS idx_apikeys_key ON apikeys(key);`,
    ];

    for (const q of queries) {
        await pool.query(q);
    }
    console.log('⚡ PostgreSQL tables initialized');
}

export const db: any = {
    query: async (text: string, params?: any[]): Promise<any> => {
        const { rows } = await pool.query(text, params);
        // Return array of rows; also expose first-row properties for legacy
        // single-document callers via a Proxy. Iteration/map/filter still work.
        return new Proxy(rows, {
            get(target: any, prop: any) {
                if (prop in target) return target[prop];
                const first = target[0];
                if (first && prop in first) return first[prop];
                return undefined;
            },
        });
    },
    
    // Helper methods to mimic old collections
    users: () => ({
        findOne: async (filter: any) => {
            const { rows } = await pool.query(
                'SELECT * FROM users WHERE discord_id = $1',
                [filter.discordId || filter.discord_id]
            );
            return rows[0] || null;
        },
        updateOne: async (filter: any, update: any, options?: any) => {
            const discordId = filter.discordId || filter.discord_id;
            const data = update.$set || update;
            await pool.query(
                `INSERT INTO users (discord_id, username, global_name, avatar, access_token, riot_connection, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                 ON CONFLICT (discord_id) DO UPDATE SET
                 username = COALESCE(EXCLUDED.username, users.username),
                 global_name = COALESCE(EXCLUDED.global_name, users.global_name),
                 avatar = COALESCE(EXCLUDED.avatar, users.avatar),
                 access_token = COALESCE(EXCLUDED.access_token, users.access_token),
                 riot_connection = COALESCE(EXCLUDED.riot_connection, users.riot_connection),
                 updated_at = CURRENT_TIMESTAMP`,
                [
                    discordId,
                    data.username,
                    data.globalName,
                    data.avatar,
                    data.accessToken,
                    data.riotConnection ? JSON.stringify(data.riotConnection) : null
                ]
            );
        },
        // Add more helpers as needed...
    }),

    sessions: () => ({
        findOne: async (filter: any) => {
            const { rows } = await pool.query(
                'SELECT * FROM sessions WHERE session_id = $1 AND expires_at > CURRENT_TIMESTAMP',
                [filter.sessionId]
            );
            return rows[0] || null;
        },
        insertOne: async (doc: any) => {
            await pool.query(
                'INSERT INTO sessions (session_id, discord_id, expires_at) VALUES ($1, $2, $3)',
                [doc.sessionId, doc.discordId, doc.expiresAt]
            );
        },
        deleteOne: async (filter: any) => {
            await pool.query('DELETE FROM sessions WHERE session_id = $1', [filter.sessionId]);
        }
    }),

    stats: () => ({
        findOne: async () => {
            const { rows } = await pool.query("SELECT * FROM stats WHERE id = 'dashboard'");
            return rows[0] || null;
        },
        updateOne: async (_filter: any, update: any) => {
            const data = update.$set || update;
            await pool.query(
                `INSERT INTO stats (id, users, servers, updated_at)
                 VALUES ('dashboard', $1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (id) DO UPDATE SET
                 users = $1, servers = $2, updated_at = CURRENT_TIMESTAMP`,
                [data.users, data.servers]
            );
        }
    }),

    announcements: () => ({
        findOne: async (filter: any) => {
            const { rows } = await pool.query(
                'SELECT * FROM announcements WHERE active = true LIMIT 1'
            );
            return rows[0] || null;
        },
        updateOne: async (_filter: any, update: any) => {
            const data = update.$set || update;
            await pool.query(
                `INSERT INTO announcements (title, message, color, active, updated_at)
                 VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
                 ON CONFLICT DO NOTHING`,
                [data.title, data.message, data.color]
            );
        },
        deleteOne: async () => {
            await pool.query('UPDATE announcements SET active = false');
        }
    }),

    apikeys: () => ({
        find: async () => {
            const { rows } = await pool.query('SELECT * FROM apikeys ORDER BY created_at DESC');
            return rows;
        },
        insertOne: async (doc: any) => {
            await pool.query(
                'INSERT INTO apikeys (name, key, created_by) VALUES ($1, $2, $3)',
                [doc.name, doc.key, doc.createdBy]
            );
        },
        deleteOne: async (filter: any) => {
            await pool.query('DELETE FROM apikeys WHERE id = $1', [filter._id]);
        }
    }),

    statusChecks: () => ({
        insertOne: async (doc: any) => {
            await pool.query(
                'INSERT INTO status_checks (service_id, ok, latency_ms, at) VALUES ($1, $2, $3, $4)',
                [doc.serviceId, doc.ok, doc.latencyMs, doc.at]
            );
        },
        find: async (filter: any) => {
            const { rows } = await pool.query(
                'SELECT * FROM status_checks WHERE service_id = $1 AND at >= $2 ORDER BY at',
                [filter.serviceId, filter.at?.$gte]
            );
            return rows;
        }
    })
};