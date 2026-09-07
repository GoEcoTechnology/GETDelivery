import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const [order] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, 14));
  return NextResponse.json({ order });
}
