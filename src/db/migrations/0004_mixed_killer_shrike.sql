CREATE TABLE "partner_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"delivery_partner_id" integer NOT NULL,
	"delivery_order_id" integer,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_assignments" ALTER COLUMN "delivery_partner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_invitations" ADD COLUMN "decline_reason" varchar(255);--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD COLUMN "offered_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD COLUMN "temporary_winner_id" integer;--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "partner_notifications" ADD CONSTRAINT "partner_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_notifications" ADD CONSTRAINT "partner_notifications_delivery_partner_id_delivery_partners_id_fk" FOREIGN KEY ("delivery_partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_notifications" ADD CONSTRAINT "partner_notifications_delivery_order_id_delivery_orders_id_fk" FOREIGN KEY ("delivery_order_id") REFERENCES "public"."delivery_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_notif_partner_idx" ON "partner_notifications" USING btree ("delivery_partner_id");--> statement-breakpoint
CREATE INDEX "partner_notif_unread_idx" ON "partner_notifications" USING btree ("delivery_partner_id","is_read");--> statement-breakpoint
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_temporary_winner_id_delivery_partners_id_fk" FOREIGN KEY ("temporary_winner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE no action ON UPDATE no action;