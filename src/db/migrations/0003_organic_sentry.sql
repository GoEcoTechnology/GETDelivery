ALTER TABLE "delivery_batches" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "delivery_batches" CASCADE;--> statement-breakpoint
ALTER TABLE "delivery_orders" DROP CONSTRAINT "delivery_orders_batch_id_delivery_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_orders" DROP COLUMN "batch_id";