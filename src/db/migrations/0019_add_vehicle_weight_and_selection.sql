ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "total_weight" numeric(10, 2);
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "suggested_vehicle_id" integer REFERENCES "vehicles"("id");
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "vehicle_capacity_kg" integer;
ALTER TABLE "delivery_items" ADD COLUMN IF NOT EXISTS "weight_kg" numeric(10, 2);
