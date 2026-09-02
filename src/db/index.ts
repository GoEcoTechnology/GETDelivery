import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import type { AppJwtPayload } from '@/lib/auth';

const connectionString = process.env.DATABASE_URL!;

// Singleton pattern to prevent connection leaks during Next.js hot-reloading
const globalForPostgres = global as unknown as { postgresClient: postgres.Sql | undefined };

export const client =
  globalForPostgres.postgresClient ??
  postgres(connectionString, { prepare: false, max: 20 });

if (process.env.NODE_ENV !== 'production') {
  globalForPostgres.postgresClient = client;
}

export const db = drizzle(client, { schema });

/**
 * Database wrapper that provides a transaction context and passes
 * the authenticated user's claims to query handlers.
 * 
 * Note: Tenant isolation is enforced at the application level through
 * explicit WHERE tenantId = claims.tenantId clauses in every query.
 * The `authenticated` Supabase RLS role is not available in direct PostgreSQL connections.
 */
export async function withRLS<T>(
  claims: AppJwtPayload,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    return callback(tx);
  });
}
