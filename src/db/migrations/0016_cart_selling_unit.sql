ALTER TABLE "cart_items" ADD COLUMN "selling_unit_id" integer REFERENCES "product_selling_units"("id") ON DELETE set null;
