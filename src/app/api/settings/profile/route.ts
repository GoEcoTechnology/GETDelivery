import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { hashPassword } from '@/lib/password';
import { deliveryPartners } from '@/db/schema';

export async function GET(request: Request) {
  return withAuth(request, {}, async (tx, claims) => {
    // 1. Get User Profile based on role
    let user;
    if (claims.role === 'DELIVERY_PARTNER') {
      const [partner] = await tx
        .select({
          id: deliveryPartners.id,
          name: deliveryPartners.contactPerson,
          email: deliveryPartners.email,
          contactNumber: deliveryPartners.mobileNumber,
          role: deliveryPartners.companyName, // using company name as a display field in profile
          tenantId: undefined
        })
        .from(deliveryPartners)
        .where(eq(deliveryPartners.id, claims.partnerId as number));
      user = partner ? { ...partner, role: 'DELIVERY_PARTNER' } : null;
    } else {
      const [u] = await tx
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          contactNumber: users.contactNumber,
          role: users.role,
          tenantId: users.tenantId
        })
        .from(users)
        .where(eq(users.id, claims.userId as number));
      user = u;
    }

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // 2. Get Tenant Profile if applicable
    let tenant = null;
    if (user.tenantId) {
      const [t] = await tx.select().from(tenants).where(eq(tenants.id, user.tenantId));
      tenant = t;
    }

    return NextResponse.json({ user, tenant });
  });
}

export async function PUT(request: Request) {
  return withAuth(request, {}, async (tx, claims) => {
    const body = await request.json();
    
    // User Updates
    const updates: any = {};
    if (body.name) updates.name = String(body.name).trim();
    if (body.contactNumber) updates.contactNumber = String(body.contactNumber).trim();
    if (body.password) updates.passwordHash = await hashPassword(body.password);

    if (Object.keys(updates).length > 0 || body.businessName) {
      if (claims.role === 'DELIVERY_PARTNER') {
        const partnerUpdates: any = {};
        if (updates.name) partnerUpdates.contactPerson = updates.name;
        if (updates.contactNumber) partnerUpdates.mobileNumber = updates.contactNumber;
        if (updates.passwordHash) partnerUpdates.passwordHash = updates.passwordHash;
        if (body.businessName) partnerUpdates.companyName = String(body.businessName).trim();
        
        if (Object.keys(partnerUpdates).length > 0) {
          await tx.update(deliveryPartners).set(partnerUpdates).where(eq(deliveryPartners.id, claims.partnerId as number));
        }
      } else if (Object.keys(updates).length > 0) {
        await tx.update(users).set(updates).where(eq(users.id, claims.userId as number));
      }
    }

    // Tenant Updates (Only Business Owners can update Tenant details)
    if (claims.role === 'BUSINESS_OWNER' && claims.tenantId) {
      const tenantUpdates: any = {};
      if (body.businessName) tenantUpdates.name = String(body.businessName).trim();
      if (body.name) tenantUpdates.contactPerson = String(body.name).trim();
      
      if (Object.keys(tenantUpdates).length > 0) {
        await tx.update(tenants)
          .set(tenantUpdates)
          .where(eq(tenants.id, claims.tenantId as number));
      }
    }

    return NextResponse.json({ success: true });
  });
}
