-- Migration 0015: Add weight to products and selling units

ALTER TABLE "products" ADD COLUMN "weight" varchar(50);
ALTER TABLE "product_selling_units" ADD COLUMN "weight" varchar(50);
