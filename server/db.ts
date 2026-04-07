import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB POOL] Unexpected error on idle client:', err.message);
});

let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

export function startDatabaseKeepalive() {
  if (keepaliveInterval) return;
  
  keepaliveInterval = setInterval(async () => {
    try {
      await pool.query('SELECT 1');
    } catch (err: any) {
      console.error('[DB KEEPALIVE] Ping failed:', err.message);
    }
  }, 4 * 60 * 1000);
  
  console.log('[DB KEEPALIVE] Started (every 4 minutes)');
}

export const db = drizzle({ client: pool, schema });
