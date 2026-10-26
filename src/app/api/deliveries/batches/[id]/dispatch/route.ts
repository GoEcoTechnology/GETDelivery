import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryBatches, deliveryBatchItems, deliveryPartners, deliveryInvitations, notifications, platformDeliverySettings, vehicleDeliveryRates, users, vehicles } from '@/db/schema';
import { eq, and, or, isNotNull, desc, inArray, gte, ilike, asc } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';
import { deductOrderStock } from '@/lib/inventory-helper';
import crypto from 'crypto';
import { hashPassword } from '@/lib/password';
import { sendBroadcastDeliveryNotification } from '@/lib/emailWorkflowHelper';
import { canShipmentFitInVehicle } from '@/lib/deliveryCalculation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.dispatch'] }, async (tx, claims) => {
    const batchId = parseInt((await params).id, 10);
    
    if (isNaN(batchId)) {
      return NextResponse.json({ error: 'Invalid batch ID' }, { status: 400 });
    }
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // Body might be empty
    }
    const { requiredVehicleType } = body as any;

    let tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number | null;

    // Fetch and validate the batch
    const [batch] = await tx
      .select()
      .from(deliveryBatches)
      .where(
        tenantIdToUse
          ? and(eq(deliveryBatches.id, batchId), eq(deliveryBatches.tenantId, tenantIdToUse))
          : eq(deliveryBatches.id, batchId)
      );

    if (!batch) {
      return NextResponse.json({ error: 'Delivery batch not found' }, { status: 404 });
    }

    const finalTenantId = (tenantIdToUse || batch.tenantId) as number;

    if (batch.status !== 'READY_FOR_DELIVERY' && batch.status !== 'DRAFT') {
      return NextResponse.json({ error: `Cannot dispatch batch in current status: ${batch.status}` }, { status: 400 });
    }

    // Get all orders in this batch
    const batchItems = await tx
      .select({ orderId: deliveryBatchItems.customerOrderId })
      .from(deliveryBatchItems)
      .where(eq(deliveryBatchItems.batchId, batchId));

    if (batchItems.length === 0) {
      return NextResponse.json({ error: 'No orders found in this batch (batchItems empty)' }, { status: 400 });
    }
    
    const orderIds = batchItems.map((item: any) => item.orderId);

    const ordersInBatch = await tx
      .select()
      .from(deliveryOrders)
      .where(inArray(deliveryOrders.id, orderIds));

    if (ordersInBatch.length === 0) {
      return NextResponse.json({ error: 'No orders found in this batch' }, { status: 400 });
    }

    const [settings] = await tx.select().from(platformDeliverySettings).orderBy(desc(platformDeliverySettings.updatedAt)).limit(1);
    
    // Find eligible ACTIVE delivery partners
    const eligiblePartners = await tx
      .select({ 
        id: deliveryPartners.id, 
        mobileNumber: deliveryPartners.mobileNumber,
        companyName: deliveryPartners.companyName,
        email: deliveryPartners.email
      })
      .from(deliveryPartners)
      .where(and(
        or(eq(deliveryPartners.status, 'ACTIVE'), eq(deliveryPartners.status, 'AVAILABLE')),
        isNotNull(deliveryPartners.email)
      ));
      
    if (eligiblePartners.length === 0) {
      return NextResponse.json({ error: 'No active delivery partners available with a valid email address' }, { status: 400 });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    try {
      await tx.transaction(async (innerTx: any) => {
        // 0. Deduct Stock for all orders in batch
        for (const order of ordersInBatch) {
          await deductOrderStock(innerTx, finalTenantId, order.id, claims.userId as number);
        }

        // Calculate batch cargo weight authoritatively
        const ordersWeightSum = ordersInBatch.reduce((sum: number, o: any) => sum + (Number(o.totalWeight) || 0), 0);
        let batchWeight = Number(batch.totalWeight) || 0;
        if (batchWeight <= 0 || (ordersWeightSum > 0 && Math.abs(batchWeight - ordersWeightSum) > 0.01)) {
          batchWeight = ordersWeightSum;
          await innerTx.update(deliveryBatches)
            .set({ totalWeight: batchWeight.toFixed(2) })
            .where(eq(deliveryBatches.id, batchId));
        }

        // 1. Fetch batch items to evaluate physical dimensions
        const { deliveryItems, productSellingUnits } = await import('@/db/schema');
        const batchOrderItems = await innerTx
          .select({
            id: deliveryItems.id,
            productId: deliveryItems.productId,
            variantId: deliveryItems.variantId,
            unit: deliveryItems.unit,
            quantity: deliveryItems.quantity,
            weightKg: deliveryItems.weightKg,
            lengthCm: deliveryItems.lengthCm,
            widthCm: deliveryItems.widthCm,
            heightCm: deliveryItems.heightCm,
            productName: deliveryItems.productName,
          })
          .from(deliveryItems)
          .where(inArray(deliveryItems.deliveryOrderId, orderIds));

        const packingItemsForBatch: Array<{ lengthCm: number; widthCm: number; heightCm: number; quantity: number; weightKg: number; name: string }> = [];
        for (const item of batchOrderItems) {
          let l = Number(item.lengthCm) || 0;
          let w = Number(item.widthCm) || 0;
          let h = Number(item.heightCm) || 0;
          let wt = Number(item.weightKg) || 0;
          const qty = Number(item.quantity) || 1;

          if (item.productId && (!l || !w || !h)) {
            const [su] = await innerTx.select().from(productSellingUnits).where(
              and(eq(productSellingUnits.productId, item.productId), ilike(productSellingUnits.unitName, item.unit || ''))
            ).limit(1);
            if (su) {
              if (su.lengthCm && !l) l = Number(su.lengthCm);
              if (su.widthCm && !w) w = Number(su.widthCm);
              if (su.heightCm && !h) h = Number(su.heightCm);
              if (!wt && su.weightKg) wt = Number(su.weightKg) * qty;
            }
          }
          packingItemsForBatch.push({
            lengthCm: l || 50,
            widthCm: w || 40,
            heightCm: h || 30,
            quantity: qty,
            weightKg: wt,
            name: item.productName || 'Item'
          });
        }

        // 2. Fetch configured vehicle delivery rates (authoritative source for cargo dimensions & rates)
        const rates = await innerTx
          .select()
          .from(vehicleDeliveryRates)
          .where(eq(vehicleDeliveryRates.isActive, true));

        // 3. Fetch active registered vehicles
        let activeVehicles = await innerTx
          .select({
            id: vehicles.id,
            vehicleType: vehicles.vehicleType,
            capacityKg: vehicles.capacityKg,
            cargoLengthCm: vehicles.cargoLengthCm,
            cargoWidthCm: vehicles.cargoWidthCm,
            cargoHeightCm: vehicles.cargoHeightCm,
            tenantId: vehicles.tenantId,
          })
          .from(vehicles)
          .where(eq(vehicles.status, 'ACTIVE'))
          .orderBy(asc(vehicles.capacityKg));

        // Supplement vehicle instance cargo dimensions from configured vehicleDeliveryRates if null/0
        const evaluatedVehicles = activeVehicles.map((v: any) => {
          const matchedRate = rates.find((r: any) => r.vehicleType.trim().toLowerCase() === v.vehicleType.trim().toLowerCase());
          return {
            ...v,
            capacityKg: v.capacityKg || matchedRate?.capacityKg || 1000,
            cargoLengthCm: Number(v.cargoLengthCm) || Number(matchedRate?.cargoLengthCm) || 0,
            cargoWidthCm: Number(v.cargoWidthCm) || Number(matchedRate?.cargoWidthCm) || 0,
            cargoHeightCm: Number(v.cargoHeightCm) || Number(matchedRate?.cargoHeightCm) || 0,
            pricePerKm: matchedRate ? Number(matchedRate.pricePerKm) : 20,
          };
        });

        // 4. Filter vehicles by BOTH payload weight AND physical 3D cargo fit
        const eligibleVehicles = evaluatedVehicles.filter((v: any) => {
          const fitResult = canShipmentFitInVehicle(
            packingItemsForBatch,
            {
              capacityKg: v.capacityKg,
              cargoLengthCm: v.cargoLengthCm,
              cargoWidthCm: v.cargoWidthCm,
              cargoHeightCm: v.cargoHeightCm,
              vehicleType: v.vehicleType,
            }
          );
          return fitResult.fits;
        });

        // Prioritize tenant-owned vehicles if available among physically fitting ones
        const tenantVehicles = eligibleVehicles.filter((v: any) => v.tenantId === tenantIdToUse);
        const candidates = tenantVehicles.length > 0 ? tenantVehicles : eligibleVehicles;

        if (candidates.length === 0) {
          throw new Error(`Shipment requirements (total weight: ${batchWeight} kg, volume: ${packingItemsForBatch.reduce((sum, i) => sum + (i.lengthCm * i.widthCm * i.heightCm * i.quantity), 0)} cm³) exceed the usable cargo space and capacity of all available registered vehicles. No suitable vehicle can fit this shipment.`);
        }

        // Sort candidates: smallest capable vehicle tier first
        candidates.sort((a: any, b: any) => a.capacityKg - b.capacityKg);

        let selectedVehicle = candidates[0];
        if (requiredVehicleType) {
          const matchedRequired = candidates.find(
            (v: any) => v.vehicleType.trim().toLowerCase() === requiredVehicleType.trim().toLowerCase()
          );
          if (matchedRequired) {
            selectedVehicle = matchedRequired;
          }
        }

        const finalVehicleType = selectedVehicle.vehicleType;
        const vehicleCapacity = selectedVehicle.capacityKg;
        const finalPricePerKm = selectedVehicle.pricePerKm || 20;

        // 5. Update all order statuses and pricing (Strictly ZERO base price as requested!)
        for (const order of ordersInBatch) {
          const distanceKm = Number.parseFloat(String(order.routeDistance || order.distanceKm || '0').replace(/[^\d.]/g, '')) || 0;
          const finalDeliveryPrice = (distanceKm * finalPricePerKm);
          
          await innerTx
            .update(deliveryOrders)
            .set({
              status: 'WAITING_FOR_PARTNER',
              pricingFrozenAt: new Date(),
              vehicleBasePrice: '0', // Strictly ZERO base fee
              pricePerKm: finalPricePerKm.toString(),
              distanceKm: distanceKm.toString(),
              finalDeliveryPrice: finalDeliveryPrice.toFixed(2),
              normalDeliveryFee: finalDeliveryPrice.toFixed(2),
              requiredVehicleType: finalVehicleType,
              preferredVehicle: finalVehicleType,
              vehicleCapacityKg: vehicleCapacity,
              suggestedVehicleId: selectedVehicle.id,
            })
            .where(eq(deliveryOrders.id, order.id));
        }

        // 2. Mark batch as WAITING_FOR_PARTNER
        await innerTx
          .update(deliveryBatches)
          .set({ 
            status: 'WAITING_FOR_PARTNER',
            suggestedVehicleId: selectedVehicle.id,
            totalWeight: batchWeight.toString(),
          })
          .where(eq(deliveryBatches.id, batchId));
      }); // End of transaction

      // Background tasks
      (async () => {
        try {
          const invitationsToInsert = [];
          
          // Only create invitations for the FIRST order in the batch to avoid duplicate UI cards
          // The single parent order will represent the entire batch.
          const firstOrder = ordersInBatch[0];
          
          const tokens = eligiblePartners.map(() => crypto.randomBytes(32).toString('hex'));
          const tokenHashes = await Promise.all(tokens.map((t: string) => hashPassword(t)));

          const orderInvitations = eligiblePartners.map((partner: any, i: number) => ({
            tenantId: tenantIdToUse,
            deliveryOrderId: firstOrder.id, // Only use firstOrder.id
            deliveryPartnerId: partner.id,
            tokenHash: tokenHashes[i],
            status: 'PENDING',
            expiresAt
          }));
          
          invitationsToInsert.push(...orderInvitations);

          if (invitationsToInsert.length > 0) {
            await db.insert(deliveryInvitations).values(invitationsToInsert);
          }

          // Send 1 broadcast email per partner using the first order in the batch
          const deliveryDate = firstOrder.deliveryDate
            ? new Date(firstOrder.deliveryDate).toLocaleDateString('en-PH', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : 'As soon as possible';

          const acceptUrl = `${process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/partner/orders/${firstOrder.id}`;

          const partnerEmailList = eligiblePartners.map((p: { id: number; email: string | null; companyName: string | null }) => ({
            id: p.id,
            email: p.email,
            companyName: p.companyName
          }));

          const bodyStr = await buildStandardNotificationBody('New Batch Delivery Request', {
            orderId: firstOrder.id,
            status: 'PENDING',
            reason: `New batch of ${ordersInBatch.length} orders available for pickup`
          });

          const newNotifsToInsert: any[] = [];
          for (const partner of eligiblePartners) {
            if (!partner.email) continue;
            newNotifsToInsert.push({
              tenantId: tenantIdToUse,
              deliveryOrderId: firstOrder.id, // attach notif to first order
              senderId: claims.userId || null,
              receiverId: partner.id,
              receiverRole: 'DELIVERY_PARTNER',
              recipientEmail: partner.email,
              notificationType: 'new_delivery_request',
              title: 'New Batch Delivery Request Available',
              body: bodyStr,
              actionUrl: acceptUrl,
              status: 'UNREAD'
            });
          }

          // Notifications for Customers
          for (const order of ordersInBatch) {
            if (order.customerId) {
              newNotifsToInsert.push({
                tenantId: tenantIdToUse,
                deliveryOrderId: order.id,
                senderId: claims.userId || null,
                receiverId: order.customerId,
                receiverRole: 'CUSTOMER',
                recipientEmail: null,
                notificationType: 'order_dispatched',
                title: 'Order Dispatched',
                body: `Your order has been dispatched and is looking for a delivery partner.`,
                actionUrl: `/orders`,
                status: 'UNREAD'
              });
            }
          }

          if (newNotifsToInsert.length > 0) {
            await db.insert(notifications).values(newNotifsToInsert);
          }

          const [businessOwnerUser] = await db.select({ contact: users.contactNumber })
            .from(users)
            .where(and(eq(users.tenantId, finalTenantId), eq(users.role, 'BUSINESS_OWNER')))
            .limit(1);
          const ownerContact = businessOwnerUser?.contact || undefined;
          const dropoffAddr = ordersInBatch.length > 1 ? 'Multiple Drop Offs' : firstOrder.dropoffAddress;

          if (partnerEmailList && partnerEmailList.length > 0) {
            await sendBroadcastDeliveryNotification(
              finalTenantId,
              firstOrder.id,
              firstOrder.customerName, // Removed in template, but still part of function signature
              firstOrder.pickupAddress,
              dropoffAddr,
              deliveryDate,
              ownerContact,
              firstOrder.instructions || undefined,
              partnerEmailList,
              acceptUrl,
              firstOrder.id
            ).catch((err: any) => {
              console.error('Failed to send unified broadcast email:', err.message);
            });
          }
        } catch (err) {
          console.error('Error in background dispatch tasks:', err);
        }
      })();

      return NextResponse.json({ 
        success: true, 
        message: `Batch dispatched to ${eligiblePartners.length} partners. Broadcast emails sent successfully.`
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to dispatch batch due to inventory constraints' }, { status: 400 });
    }
  });
}
