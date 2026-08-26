CREATE TABLE "tenant_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"delivery_order_id" integer,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_notifications" ADD CONSTRAINT "tenant_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_notifications" ADD CONSTRAINT "tenant_notifications_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_notif_tenant_idx" ON "tenant_notifications" USING btree ("tenant_id");