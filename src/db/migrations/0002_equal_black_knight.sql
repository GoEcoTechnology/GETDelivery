CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"customer_code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_person" varchar(255),
	"mobile_number" varchar(50) NOT NULL,
	"email" varchar(255),
	"address" text NOT NULL,
	"municipality" varchar(100),
	"barangay" varchar(100),
	"notes" text,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"quota_required" integer NOT NULL,
	"current_quota_orders" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING_ACCUMULATION' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD COLUMN "batch_id" integer;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "license_number" varchar(100);--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "license_type" varchar(50);--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "license_restrictions" varchar(255);--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "license_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "license_status" varchar(50) DEFAULT 'VALID';--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "registration_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "registration_status" varchar(50) DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "or_number" varchar(100);--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "cr_number" varchar(100);--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customers_code_idx" ON "customers" USING btree ("customer_code");--> statement-breakpoint
CREATE INDEX "batches_tenant_idx" ON "delivery_batches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "batches_status_idx" ON "delivery_batches" USING btree ("status");--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_batch_id_delivery_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."delivery_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drivers_license_expiry_idx" ON "drivers" USING btree ("license_expiry");--> statement-breakpoint
CREATE INDEX "vehicles_reg_expiry_idx" ON "vehicles" USING btree ("registration_expiry");--> statement-breakpoint
CREATE INDEX "vehicles_plate_idx" ON "vehicles" USING btree ("plate_number");