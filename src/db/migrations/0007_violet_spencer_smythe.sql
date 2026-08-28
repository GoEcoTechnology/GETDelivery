DROP TABLE "device_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "notification_queue" CASCADE;--> statement-breakpoint
DROP TABLE "sms_queue" CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "recipient_email" varchar(255);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "failed_at" timestamp;