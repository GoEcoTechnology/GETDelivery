-- Migration 0014: Product Architecture Refactor

-- 1. Add parent_id to products
ALTER TABLE "products" ADD COLUMN "parent_id" integer;
ALTER TABLE "products" ADD CONSTRAINT "products_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;

-- 2. Create product_selling_units table
CREATE TABLE IF NOT EXISTS "product_selling_units" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "unit_name" varchar(255) NOT NULL,
  "equivalent_qty" numeric(10, 2) NOT NULL,
  "price" numeric(10, 2),
  "status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "product_selling_units" ADD CONSTRAINT "product_selling_units_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "product_selling_units" ADD CONSTRAINT "product_selling_units_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;

-- 3. Add RLS for product_selling_units
ALTER TABLE "product_selling_units" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ProductSellingUnits: Platform Owner full access" ON "product_selling_units"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "users" u WHERE u."id"::text = auth.uid()::text AND u."role" = 'PLATFORM_OWNER')
  );

CREATE POLICY "ProductSellingUnits: Tenant access own" ON "product_selling_units"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM "users" u WHERE u."id"::text = auth.uid()::text AND u."tenant_id" = "product_selling_units"."tenant_id")
  );

CREATE POLICY "ProductSellingUnits: Customers read active" ON "product_selling_units"
  FOR SELECT USING ("status" = 'ACTIVE');

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "products_parent_idx" ON "products" ("parent_id");
CREATE INDEX IF NOT EXISTS "selling_units_tenant_idx" ON "product_selling_units" ("tenant_id");
CREATE INDEX IF NOT EXISTS "selling_units_product_idx" ON "product_selling_units" ("product_id");
