const { config } = require('dotenv');
config({path: '.env'});

const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const schema = require('./src/db/schema');
const { desc } = require('drizzle-orm');

const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

async function main() {
  const orders = await db.select({
    id: schema.deliveryOrders.id,
    status: schema.deliveryOrders.status,
    batchId: schema.deliveryOrders.batchId,
    total: schema.deliveryOrders.offeredAmount
  }).from(schema.deliveryOrders).orderBy(desc(schema.deliveryOrders.createdAt)).limit(10);
  console.log(orders);
  process.exit(0);
}
main();
