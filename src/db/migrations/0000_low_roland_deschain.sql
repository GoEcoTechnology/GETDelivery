CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"actor_id" integer,
	"actor_type" varchar(50),
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100),
	"entity_id" integer,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"delivery_order_id" integer NOT NULL,
	"delivery_partner_id" integer NOT NULL,
	"driver_name" varchar(255) NOT NULL,
	"vehicle_details" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'ASSIGNED' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"delivery_order_id" integer NOT NULL,
	"delivery_partner_id" integer NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"opened_at" timestamp,
	"responded_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"delivery_order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "delivery_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_contact" varchar(100),
	"pickup_address" text NOT NULL,
	"dropoff_address" text NOT NULL,
	"delivery_date" timestamp,
	"delivery_time" varchar(50),
	"instructions" text,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"contact_person" varchar(255) NOT NULL,
	"mobile_number" varchar(50) NOT NULL,
	"email" varchar(255),
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"notification_token" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_partners_mobile_number_unique" UNIQUE("mobile_number")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"delivery_partner_id" integer,
	"name" varchar(255) NOT NULL,
	"mobile" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"transaction_type" varchar(20) NOT NULL,
	"reference" varchar(255),
	"performed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"delivery_order_id" integer,
	"recipient_type" varchar(50) NOT NULL,
	"recipient_id" integer NOT NULL,
	"channel" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_message_id" varchar(255),
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"sku" varchar(100),
	"barcode" varchar(100),
	"category" varchar(100),
	"unit" varchar(50),
	"price" numeric(10, 2),
	"stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 0,
	"product_type" varchar(50),
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"delivery_order_id" integer,
	"recipient_mobile" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_message_id" varchar(255),
	"sent_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"subscription_plan" varchar(50) DEFAULT 'FREE' NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"delivery_partner_id" integer,
	"plate_number" varchar(50) NOT NULL,
	"vehicle_type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_invitations" ADD CONSTRAINT "delivery_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_invitations" ADD CONSTRAINT "delivery_invitations_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_invitations" ADD CONSTRAINT "delivery_invitations_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_queue" ADD CONSTRAINT "sms_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_queue" ADD CONSTRAINT "sms_queue_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "assignments_tenant_idx" ON "delivery_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "assignments_order_idx" ON "delivery_assignments" USING btree ("delivery_order_id");--> statement-breakpoint
CREATE INDEX "invitations_tenant_idx" ON "delivery_invitations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invitations_order_idx" ON "delivery_invitations" USING btree ("delivery_order_id");--> statement-breakpoint
CREATE INDEX "invitations_token_idx" ON "delivery_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "items_order_idx" ON "delivery_items" USING btree ("delivery_order_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_idx" ON "delivery_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "delivery_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "partners_mobile_idx" ON "delivery_partners" USING btree ("mobile_number");--> statement-breakpoint
CREATE INDEX "partners_status_idx" ON "delivery_partners" USING btree ("status");--> statement-breakpoint
CREATE INDEX "drivers_tenant_idx" ON "drivers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inv_trans_tenant_idx" ON "inventory_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inv_trans_product_idx" ON "inventory_transactions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "notif_status_idx" ON "notification_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notif_tenant_idx" ON "notification_queue" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "products_tenant_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "sms_status_idx" ON "sms_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sms_tenant_idx" ON "sms_queue" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vehicles_tenant_idx" ON "vehicles" USING btree ("tenant_id");