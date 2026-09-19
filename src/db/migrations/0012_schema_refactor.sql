-- Migration 0012: Schema Refactor (Phase 9)

-- 1. Alter inventory_transactions to include stock_ins data
ALTER TABLE "inventory_transactions" ADD COLUMN "supplier" varchar(255);
ALTER TABLE "inventory_transactions" ADD COLUMN "unit_cost" varchar(50);
ALTER TABLE "inventory_transactions" ADD COLUMN "notes" text;

-- 2. Migrate data from stock_ins to inventory_transactions
INSERT INTO "inventory_transactions" ("tenant_id", "product_id", "quantity", "previous_stock", "new_stock", "transaction_type", "reference", "supplier", "unit_cost", "notes", "performed_by", "created_at")
SELECT "tenant_id", "product_id", "quantity", 0, "quantity", 'IN', "reference_number", "supplier", "unit_cost", "notes", "performed_by", "created_at"
FROM "stock_ins";

-- 3. Alter drivers
ALTER TABLE "drivers" DROP COLUMN IF EXISTS "license_restrictions";
ALTER TABLE "drivers" DROP COLUMN IF EXISTS "license_status";
ALTER TABLE "drivers" ALTER COLUMN "tenant_id" DROP NOT NULL;

-- 4. Alter vehicles
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "registration_status";
ALTER TABLE "vehicles" ALTER COLUMN "tenant_id" DROP NOT NULL;

-- 5. Alter notifications
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "sent_at";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "failed_at";

-- 6. Migrate partner_notifications to unified notifications table
INSERT INTO "notifications" ("tenant_id", "delivery_order_id", "receiver_id", "receiver_role", "notification_type", "title", "body", "status", "created_at")
SELECT "tenant_id", "delivery_order_id", "delivery_partner_id", 'DELIVERY_PARTNER', 'SYSTEM', "title", "body", CASE WHEN "is_read" = true THEN 'READ' ELSE 'UNREAD' END, "created_at"
FROM "partner_notifications";

-- 7. Drop deprecated tables
DROP TABLE IF EXISTS "stock_ins" CASCADE;
DROP TABLE IF EXISTS "partner_notifications" CASCADE;
DROP TABLE IF EXISTS "tenant_notifications" CASCADE;
DROP TABLE IF EXISTS "notification_queue" CASCADE;
DROP TABLE IF EXISTS "customer_addresses" CASCADE;
DROP TABLE IF EXISTS "product_variants" CASCADE;
DROP TABLE IF EXISTS "product_selling_units" CASCADE;
