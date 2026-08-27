import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
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
 * Secure database transaction wrapper that enforces Supabase RLS.
 * It injects the authenticated user's JWT claims into the PostgreSQL session
 * before running queries.
 */
export async function withRLS<T>(
  claims: AppJwtPayload,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // 1. Drop down from 'postgres' superuser to 'authenticated' to enable RLS checks
    await tx.execute(sql`set local role authenticated`);
    
    // 2. Inject tenant_id if available
    if ('tenantId' in claims && claims.tenantId !== null && claims.tenantId !== undefined) {
      await tx.execute(sql`SELECT set_config('request.jwt.claim.tenant_id', ${claims.tenantId.toString()}, true)`);
    } else {
      await tx.execute(sql`SELECT set_config('request.jwt.claim.tenant_id', '', true)`);
    }

    // 3. Inject role and IDs
    if ('role' in claims) {
      await tx.execute(sql`SELECT set_config('request.jwt.claim.role', ${claims.role}, true)`);
      if (claims.partnerId) {
        await tx.execute(sql`SELECT set_config('request.jwt.claim.partner_id', ${claims.partnerId.toString()}, true)`);
      }
      if (claims.userId) {
        await tx.execute(sql`SELECT set_config('request.jwt.claim.user_id', ${claims.userId.toString()}, true)`);
      }
    } else if (claims.type === 'PARTNER_INVITE') {
      await tx.execute(sql`SELECT set_config('request.jwt.claim.role', 'DELIVERY_PARTNER', true)`);
      await tx.execute(sql`SELECT set_config('request.jwt.claim.partner_id', ${claims.partnerId.toString()}, true)`);
    } else if (claims.type === 'DRIVER_ACCESS') {
      await tx.execute(sql`SELECT set_config('request.jwt.claim.role', 'DRIVER', true)`);
      await tx.execute(sql`SELECT set_config('request.jwt.claim.assignment_id', ${claims.assignmentId.toString()}, true)`);
    }

    return callback(tx);
  });
}
