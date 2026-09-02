CREATE TABLE IF NOT EXISTS "delivery_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"max_orders" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD COLUMN "batch_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_batch_id_delivery_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "delivery_batches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batches_tenant_idx" ON "delivery_batches" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "batches_status_idx" ON "delivery_batches" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_batch_idx" ON "delivery_orders" ("batch_id");