CREATE TABLE IF NOT EXISTS "platform_delivery_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "price_per_km" numeric(10,2) NOT NULL DEFAULT '0',
  "currency_code" varchar(10) NOT NULL DEFAULT 'PHP',
  "updated_by" integer,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "platform_delivery_settings"
    ADD CONSTRAINT "platform_delivery_settings_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "vehicle_delivery_rates" (
  "id" serial PRIMARY KEY NOT NULL,
  "vehicle_type" varchar(100) NOT NULL,
  "base_price" numeric(10,2) NOT NULL DEFAULT '0',
  "is_active" boolean NOT NULL DEFAULT true,
  "updated_by" integer,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "vehicle_delivery_rates"
    ADD CONSTRAINT "vehicle_delivery_rates_vehicle_type_unique"
    UNIQUE ("vehicle_type");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "vehicle_delivery_rates"
    ADD CONSTRAINT "vehicle_delivery_rates_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "delivery_orders"
  ADD COLUMN IF NOT EXISTS "required_vehicle_type" varchar(100),
  ADD COLUMN IF NOT EXISTS "vehicle_base_price" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "price_per_km" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "distance_km" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "final_delivery_price" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "pricing_frozen_at" timestamp;
