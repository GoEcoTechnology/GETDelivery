ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_assignments" DROP CONSTRAINT "delivery_assignments_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_invitations" DROP CONSTRAINT "delivery_invitations_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_orders" DROP CONSTRAINT "delivery_orders_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "drivers" DROP CONSTRAINT "drivers_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory_transactions" DROP CONSTRAINT "inventory_transactions_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_queue" DROP CONSTRAINT "notification_queue_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "sms_queue" DROP CONSTRAINT "sms_queue_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_invitations" ADD CONSTRAINT "delivery_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_queue" ADD CONSTRAINT "sms_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_tenant_status_idx" ON "delivery_orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "orders_tenant_created_idx" ON "delivery_orders" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "inv_trans_tenant_created_idx" ON "inventory_transactions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "products_tenant_status_idx" ON "products" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "products_tenant_category_idx" ON "products" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "users_tenant_status_idx" ON "users" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_barcode_trgm_idx" ON "products" USING gin ("barcode" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_name_trgm_idx" ON "users" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drivers_name_trgm_idx" ON "drivers" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_plate_trgm_idx" ON "vehicles" USING gin ("plate_number" gin_trgm_ops);

