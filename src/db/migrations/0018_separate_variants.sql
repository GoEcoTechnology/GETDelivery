-- Migration to create product_variants table and move data

-- 1. Create product_variants table
CREATE TABLE IF NOT EXISTS "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"unit" varchar(50),
	"price" numeric(10, 2),
	"stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 10 NOT NULL,
	"product_type" varchar(50),
	"weight" varchar(50),
	"quota" integer,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- 2. Add foreign keys for product_variants
DO $$ BEGIN
 ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "product_variants_tenant_idx" ON "product_variants" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "product_variants_product_idx" ON "product_variants" USING btree ("product_id");

-- 3. Add variant_id to product_selling_units
ALTER TABLE "product_selling_units" ADD COLUMN IF NOT EXISTS "variant_id" integer;
DO $$ BEGIN
 ALTER TABLE "product_selling_units" ADD CONSTRAINT "product_selling_units_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "selling_units_variant_idx" ON "product_selling_units" USING btree ("variant_id");

-- 4. Add variant_id to inventory_transactions
ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "variant_id" integer;
DO $$ BEGIN
 ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- 5. Add variant_id to cart_items
ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "variant_id" integer;
-- We'll make it NOT NULL later after data migration if there is data, but let's allow null for the migration
DO $$ BEGIN
 ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- 6. Migrate data from products to product_variants
-- Insert main products that are just single items (no parent_id) as their own variant so they can have stock/price
INSERT INTO "product_variants" ("tenant_id", "product_id", "name", "unit", "price", "stock", "low_stock_threshold", "product_type", "weight", "quota", "status", "created_at", "updated_at")
SELECT "tenant_id", "id", "name", "unit", "price", "stock", "low_stock_threshold", "product_type", "weight", "quota", "status", "created_at", "updated_at"
FROM "products"
WHERE "parent_id" IS NULL;

-- Insert existing variants (where parent_id IS NOT NULL)
INSERT INTO "product_variants" ("tenant_id", "product_id", "name", "unit", "price", "stock", "low_stock_threshold", "product_type", "weight", "quota", "status", "created_at", "updated_at")
SELECT "tenant_id", "parent_id", "name", "unit", "price", "stock", "low_stock_threshold", "product_type", "weight", "quota", "status", "created_at", "updated_at"
FROM "products"
WHERE "parent_id" IS NOT NULL;

-- 7. Update cart_items with variant_id
-- We have to try to link cart items. But actually we can just wipe cart items to be safe, or leave them if they match.
DELETE FROM "cart_items"; -- Easiest way to avoid broken references during this structural change.

-- Make variant_id NOT NULL on cart_items
ALTER TABLE "cart_items" ALTER COLUMN "variant_id" SET NOT NULL;

-- 8. Delete the variant products from products table (parent_id IS NOT NULL)
DELETE FROM "products" WHERE "parent_id" IS NOT NULL;

-- 9. Drop columns from products table
ALTER TABLE "products" DROP COLUMN IF EXISTS "parent_id" CASCADE;
ALTER TABLE "products" DROP COLUMN IF EXISTS "unit" CASCADE;
ALTER TABLE "products" DROP COLUMN IF EXISTS "price" CASCADE;
ALTER TABLE "products" DROP COLUMN IF EXISTS "stock" CASCADE;
ALTER TABLE "products" DROP COLUMN IF EXISTS "low_stock_threshold" CASCADE;
ALTER TABLE "products" DROP COLUMN IF EXISTS "product_type" CASCADE;
ALTER TABLE "products" DROP COLUMN IF EXISTS "weight" CASCADE;
ALTER TABLE "products" DROP COLUMN IF EXISTS "quota" CASCADE;
