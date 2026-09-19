import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cartItems, products, productVariants, tenants, customers, productSellingUnits, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('customerId'); // Frontend passes user.id here

    if (!userIdParam) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    // Translate userId to actual customerId
    const customer = await db.select().from(customers).where(eq(customers.userId, parseInt(userIdParam)));
    if (customer.length === 0) {
      return NextResponse.json([], { status: 200 }); // No customer profile yet = empty cart
    }
    const realCustomerId = customer[0].id;

    const items = await db
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
        product: {
          id: products.id,
          name: productVariants.name,
          parentName: products.name,
          price: productVariants.price,
          tenantId: products.tenantId,
          tenantName: tenants.name,
          variantId: productVariants.id,
          unit: productVariants.unit,
        },
        sellingUnit: {
          id: productSellingUnits.id,
          name: productSellingUnits.unitName,
          price: productSellingUnits.price,
        }
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .leftJoin(tenants, eq(products.tenantId, tenants.id))
      .leftJoin(productSellingUnits, eq(cartItems.sellingUnitId, productSellingUnits.id))
      .where(eq(cartItems.customerId, realCustomerId));

    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    console.error('Cart GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId: userId, productId, sellingUnitId, quantity, clearCart } = body; // Frontend passes user.id as customerId

    if (!userId || !productId || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find the customer record for this user
    let customer = await db.select().from(customers).where(eq(customers.userId, parseInt(userId)));
    let realCustomerId;

    if (customer.length === 0) {
      // Get the tenantId from the product's variant
      const variantForTenant = await db.select({ tenantId: productVariants.tenantId }).from(productVariants).where(eq(productVariants.id, parseInt(productId))).limit(1);
      
      let customerTenantId = variantForTenant[0]?.tenantId;
      if (!customerTenantId) {
        const [anyTenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);
        customerTenantId = anyTenant?.id || 1;
      }

      // Verify the user actually exists before trying to create a customer
      const [user] = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      if (!user) {
        return NextResponse.json({ error: 'User session invalid. Please log out and log in again.' }, { status: 401 });
      }

      // Create a default customer record if it doesn't exist for some reason
      const [newCustomer] = await db.insert(customers).values({
        userId: parseInt(userId),
        tenantId: customerTenantId,
        name: user.name || 'Guest Customer',
        mobileNumber: user.contactNumber || 'N/A',
        address: 'N/A',
        status: 'ACTIVE'
      }).returning();
      realCustomerId = newCustomer.id;
    } else {
      realCustomerId = customer[0].id;
    }

    // We need the product's tenantId to satisfy the NOT NULL constraint in the cart_items table
    const variantInfo = await db.select({ tenantId: productVariants.tenantId, productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, productId));
    if (variantInfo.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    const tenantId = variantInfo[0].tenantId;
    const realProductId = variantInfo[0].productId;
    const variantId = productId;

    if (clearCart) {
      await db.delete(cartItems).where(eq(cartItems.customerId, realCustomerId));
    }

    // Check if item already exists in cart with same product AND same selling unit
    const existing = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.customerId, realCustomerId),
          eq(cartItems.variantId, variantId),
          sellingUnitId ? eq(cartItems.sellingUnitId, sellingUnitId) : isNull(cartItems.sellingUnitId)
        )
      );

    if (existing.length > 0) {
      // Update quantity
      await db
        .update(cartItems)
        .set({ quantity: existing[0].quantity + quantity })
        .where(eq(cartItems.id, existing[0].id));
    } else {
      // Insert new
      await db.insert(cartItems).values({
        tenantId,
        customerId: realCustomerId,
        productId: realProductId,
        variantId,
        sellingUnitId: sellingUnitId || null,
        quantity,
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Cart POST error:', error);
    const detail = error.cause ? (error.cause as any).message : error.message;
    return NextResponse.json({ error: 'DB Error: ' + detail }, { status: 500 });
  }
}
