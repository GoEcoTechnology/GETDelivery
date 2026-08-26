import { config } from 'dotenv';
config();
const { client } = require('./src/db/index');

async function runSQL() {
  console.log('Altering database schema manually...');
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "tenant_notifications" (
        "id" serial PRIMARY KEY NOT NULL,
        "tenant_id" integer NOT NULL,
        "delivery_order_id" integer,
        "title" varchar(255) NOT NULL,
        "body" text NOT NULL,
        "is_read" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `;
    await client`
      DO $$ BEGIN
        ALTER TABLE "tenant_notifications" ADD CONSTRAINT "tenant_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        ALTER TABLE "tenant_notifications" ADD CONSTRAINT "tenant_notifications_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE no action ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    await client`CREATE INDEX IF NOT EXISTS "tenant_notif_tenant_idx" ON "tenant_notifications" ("tenant_id");`;
    
    console.log('Successfully created tenant_notifications table.');
  } catch(e) {
    console.error(e);
  }
  await client.end();
  process.exit(0);
}

runSQL();
