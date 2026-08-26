import { NextResponse } from 'next/server';
import { db } from '@/db';
import { 
  deliveryAssignments, 
  deliveryOrders, 
  deliveryItems, 
  products, 
  inventoryTransactions,
  deliveryPartners
} from '@/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

const VALID_TRANSITIONS: Record<string, string[]> = {
  'ASSIGNED': ['ARRIVING_AT_PICKUP'],
  'ARRIVING_AT_PICKUP': ['ARRIVED_AT_PICKUP'],
  'ARRIVED_AT_PICKUP': ['PICKED_UP'],
  'PICKED_UP': ['IN_TRANSIT'],
  'IN_TRANSIT': ['ARRIVED_AT_DESTINATION'],
  'ARRIVED_AT_DESTINATION': ['DELIVERED'],
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    return await withAuth(request, {}, async (tx, claims) => {
      
      if (claims.type !== 'DRIVER_ACCESS') {
        return NextResponse.json({ error: 'Forbidden: Driver access required' }, { status: 403 });
      }

      const assignmentId = parseInt((await params).assignmentId, 10);
      
      // Security: The driver can ONLY update their specific assignmentId embedded in their JWT
      if (assignmentId !== claims.assignmentId) {
        return NextResponse.json({ error: 'Forbidden: Invalid assignment ID' }, { status: 403 });
      }

      const { status } = await request.json();
      if (!status) {
        return NextResponse.json({ error: 'Status is required' }, { status: 400 });
      }

      return await tx.transaction(async (innerTx: any) => {
        // 1. Fetch current assignment and order
        const [assignment] = await innerTx
          .select()
          .from(deliveryAssignments)
          .where(eq(deliveryAssignments.id, assignmentId));

        if (!assignment) {
          throw new Error('Assignment not found');
        }

        // Check valid transition
        const allowedNextStatuses = VALID_TRANSITIONS[assignment.status] || [];
        if (!allowedNextStatuses.includes(status)) {
          throw new Error(`Invalid status transition from ${assignment.status} to ${status}`);
        }

        // 2. Fetch order to ensure it matches
        const [order] = await innerTx
          .select()
          .from(deliveryOrders)
          .where(eq(deliveryOrders.id, assignment.deliveryOrderId));

        if (!order) {
          throw new Error('Delivery order not found');
        }

        // 3. Update the Assignment Status
        await innerTx
          .update(deliveryAssignments)
          .set({ status })
          .where(eq(deliveryAssignments.id, assignment.id));

        // 4. Mirror the status to the Delivery Order
        await innerTx
          .update(deliveryOrders)
          .set({ status })
          .where(eq(deliveryOrders.id, order.id));

        // ==========================================
        // SPECIAL LOGIC: PICKED_UP triggers Inventory Stock Out
        // ==========================================
        if (status === 'PICKED_UP') {
          const items = await innerTx
            .select()
            .from(deliveryItems)
            .where(eq(deliveryItems.deliveryOrderId, order.id));

          if (items.length > 0) {
            const productIds = items.map((i: any) => i.productId);
            const itemMap = new Map<number, number>();
            items.forEach((i: any) => {
              itemMap.set(i.productId, (itemMap.get(i.productId) || 0) + i.quantity);
            });

            // Fetch products FOR UPDATE to lock the row and prevent race conditions
            const lockedProducts = await innerTx
              .select({ id: products.id, stock: products.stock, tenantId: products.tenantId })
              .from(products)
              .where(inArray(products.id, productIds))
              .for('update');
            
            const transactionsToInsert = [];

            for (const product of lockedProducts) {
              const quantityToDeduct = itemMap.get(product.id) || 0;

              if (product.stock < quantityToDeduct) {
                throw new Error(`Insufficient stock for Product ID ${product.id}. Available: ${product.stock}, Required: ${quantityToDeduct}`);
              }

              const newStock = product.stock - quantityToDeduct;

              // Deduct stock
              await innerTx
                .update(products)
                .set({ stock: newStock })
                .where(eq(products.id, product.id));

              // Record Inventory Transaction
              transactionsToInsert.push({
                tenantId: order.tenantId,
                productId: product.id,
                quantity: quantityToDeduct,
                previousStock: product.stock,
                newStock,
                transactionType: 'OUT',
                reference: `DELIVERY_${order.id}_PICKUP`,
              });
            }

            if (transactionsToInsert.length > 0) {
               await innerTx.insert(inventoryTransactions).values(transactionsToInsert);
            }
          }
        }

        return NextResponse.json({ success: true, status });
      });
    });
  } catch (error: any) {
    // Return safe errors to the client
    if (error.message.includes('Invalid status transition') || error.message.includes('Insufficient stock')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Driver status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

