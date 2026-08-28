CREATE TABLE "device_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_role" varchar(50) NOT NULL,
	"tenant_id" integer,
	"fcm_token" text NOT NULL,
	"device_name" varchar(255),
	"browser" varchar(100),
	"operating_system" varchar(100),
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_fcm_token_unique" UNIQUE("fcm_token")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"delivery_order_id" integer,
	"sender_id" integer,
	"receiver_id" integer NOT NULL,
	"receiver_role" varchar(50) NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"image" varchar(255),
	"action_url" varchar(255),
	"status" varchar(50) DEFAULT 'UNREAD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	"clicked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "delivery_assignments" DROP CONSTRAINT "delivery_assignments_delivery_order_id_delivery_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_invitations" DROP CONSTRAINT "delivery_invitations_delivery_order_id_delivery_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "delivery_items" DROP CONSTRAINT "delivery_items_delivery_order_id_delivery_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_queue" DROP CONSTRAINT "notification_queue_delivery_order_id_delivery_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "partner_notifications" DROP CONSTRAINT "partner_notifications_delivery_order_id_delivery_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "sms_queue" DROP CONSTRAINT "sms_queue_delivery_order_id_delivery_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "tenant_notifications" DROP CONSTRAINT "tenant_notifications_delivery_order_id_delivery_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dt_user_idx" ON "device_tokens" USING btree ("user_id","user_role");--> statement-breakpoint
CREATE INDEX "dt_token_idx" ON "device_tokens" USING btree ("fcm_token");--> statement-breakpoint
CREATE INDEX "notif_receiver_idx" ON "notifications" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "notif_tenant_idx_2" ON "notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notif_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notif_status_idx_2" ON "notifications" USING btree ("status");--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_invitations" ADD CONSTRAINT "delivery_invitations_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_notifications" ADD CONSTRAINT "partner_notifications_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_queue" ADD CONSTRAINT "sms_queue_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_notifications" ADD CONSTRAINT "tenant_notifications_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE cascade ON UPDATE no action;