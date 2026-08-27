import { config } from 'dotenv';
config();
import { db } from './src/db';
import { notifications } from './src/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.transaction(async (tx) => {
      const promises = [];
      
      // Push a query builder to promises
      promises.push(
        tx.insert(notifications).values({
          tenantId: 1,
          receiverId: 1,
          receiverRole: 'DELIVERY_PARTNER',
          notificationType: 'test',
          title: 'Test',
          body: 'Test',
          status: 'UNREAD'
        })
      );
      
      // Execute another query BEFORE Promise.all
      await tx.execute(sql`SELECT 1`);
      
      promises.push(Promise.resolve(console.log('Dummy promise resolved')));
      
      await Promise.all(promises);
      
      console.log('Transaction success');
      // rollback so we don't pollute DB
      throw new Error('ROLLBACK');
    });
  } catch (error: any) {
    if (error.message === 'ROLLBACK') {
        console.log('Rolled back successfully');
    } else {
        console.error('Transaction error:', error);
    }
  }
}

main().then(() => process.exit(0));
