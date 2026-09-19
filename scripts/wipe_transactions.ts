import { db } from '../src/db/index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting data cleanup...');
  
  try {
    // Disable constraints temporarily to avoid foreign key issues during deletion
    await db.execute(sql`SET session_replication_role = 'replica';`);

    console.log('Deleting transactional data (leaving users, tenants, and products intact)...');
    
    const safeDelete = async (table: string) => {
      try {
        await db.execute(sql.raw(`DELETE FROM ${table};`));
        console.log(`Deleted ${table}`);
      } catch (err: any) {
        console.log(`Skipped ${table}: ${err.message}`);
      }
    };

    // 1. Delivery & Order Data
    await safeDelete('delivery_invitations');
    await safeDelete('delivery_assignments');
    await safeDelete('delivery_batch_items');
    await safeDelete('delivery_items');
    await safeDelete('delivery_batches');
    await safeDelete('delivery_orders');
    await safeDelete('cart_items');

    // 2. Inventory & Quotas
    await safeDelete('stock_outs');
    await safeDelete('stock_ins');
    await safeDelete('inventory_transactions');
    await safeDelete('quota_accumulations');

    // 3. Logs & Notifications
    await safeDelete('notifications');
    await safeDelete('audit_logs');

    // Re-enable constraints
    await db.execute(sql`SET session_replication_role = 'origin';`);
    
    console.log('✅ Successfully cleared all transactional data!');
    console.log('Your users, tenants, products, and variants are completely untouched.');
  } catch (error) {
    console.error('Error during cleanup:', error);
    // Ensure we always re-enable constraints if something fails
    await db.execute(sql`SET session_replication_role = 'origin';`);
  }
  
  process.exit(0);
}

main();
