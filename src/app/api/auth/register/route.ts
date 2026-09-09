import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, users, deliveryPartners } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/password';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type } = body; // 'tenant' or 'partner'

    if (type === 'tenant') {
      const { businessName, contactPerson, email, password } = body;

      if (!businessName || !email || !password) {
        return NextResponse.json({ error: 'Business Name, Email, and Password are required.' }, { status: 400 });
      }

      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
      }

      // Check if email already exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (existingUser) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 400 });
      }

      const passwordHash = await hashPassword(password);

      // Create tenant first, then user as BUSINESS_OWNER with PENDING status
      const [newTenant] = await db.insert(tenants).values({
        name: businessName,
        contactPerson: contactPerson || null,
        status: 'PENDING',
      }).returning();

      await db.insert(users).values({
        tenantId: newTenant.id,
        name: contactPerson || businessName,
        email: email.toLowerCase(),
        passwordHash,
        role: 'BUSINESS_OWNER',
        status: 'PENDING', // Must be approved by Super Admin
      });

      return NextResponse.json({
        success: true,
        message: 'Registration successful! Your account is pending Super Admin approval. You will be notified once approved.'
      }, { status: 201 });

    } else if (type === 'partner') {
      const { companyName, contactPerson, mobileNumber, email, password } = body;

      if (!companyName || !contactPerson || !mobileNumber || !email || !password) {
        return NextResponse.json({ error: 'All fields are required (Company Name, Contact Person, Mobile, Email, Password).' }, { status: 400 });
      }

      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
      }

      // Check if mobile already exists
      const [existingPartner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.mobileNumber, mobileNumber));
      if (existingPartner) {
        return NextResponse.json({ error: 'A partner with this mobile number already exists.' }, { status: 400 });
      }

      const passwordHash = await hashPassword(password);

      await db.insert(deliveryPartners).values({
        companyName,
        contactPerson,
        mobileNumber,
        email: email.toLowerCase(),
        passwordHash,
        status: 'PENDING', // Must be approved by Super Admin
      });

      return NextResponse.json({
        success: true,
        message: 'Registration successful! Your account is pending Super Admin approval. You will be notified once approved.'
      }, { status: 201 });

    } else {
      return NextResponse.json({ error: 'Invalid registration type. Must be "tenant" or "partner".' }, { status: 400 });
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
