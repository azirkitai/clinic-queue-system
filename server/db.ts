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

// Connection pool configuration optimized for Neon serverless
// Neon autoscale: Min 0.25 CU, Max 1 CU (no scale-to-zero)
// Default pool settings work well for serverless environments
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Max connections in pool (good for serverless)
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Connection timeout
});

export const db = drizzle({ client: pool, schema });

// OPTIONAL READ REPLICA SUPPORT (if CPU usage remains high):
// Neon provides read replicas for separating read/write workloads
// To enable:
// 1. Configure read replica in Neon dashboard
// 2. Add DATABASE_URL_UNPOOLED env var with read replica connection string
// 3. Uncomment code below:
//
// export const readPool = process.env.DATABASE_URL_UNPOOLED 
//   ? new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, max: 5 })
//   : pool; // Fallback to main pool if no read replica
// export const readDb = drizzle({ client: readPool, schema });
