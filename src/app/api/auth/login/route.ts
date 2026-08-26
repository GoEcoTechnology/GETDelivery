import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, deliveryPartners } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signToken, UserJwtPayload, PartnerLoginJwtPayload } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const body = await request.json();
    // Support both 'email' (from old frontend) and 'username' (new unified frontend)
    const username = body.email || body.username;
    const password = body.password;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username (Email or Mobile) and password are required' }, { status: 400 });
    }

    // Rate limit: Max 5 login attempts per minute per IP to prevent brute-force
    const rateLimitResult = await rateLimit(`login:${ip}`, 5, 60000);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
    }

    const isEmail = username.includes('@');

    if (isEmail) {
      // Authenticate as User (Admin / Tenant / Platform Owner)
      const [user] = await db.select().from(users).where(eq(users.email, username));

      if (!user || user.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Invalid credentials or inactive account' }, { status: 401 });
      }

      const isValid = await verifyPassword(password, user.passwordHash);

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const payload: UserJwtPayload = {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
      };

      const token = await signToken(payload, '7d');

      const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
      
      response.cookies.set({
        name: 'token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return response;
    } else {
      // Authenticate as Delivery Partner (Mobile Number)
      const [partner] = await db
        .select()
        .from(deliveryPartners)
        .where(eq(deliveryPartners.mobileNumber, username));

      if (!partner) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      if (!partner.passwordHash) {
        return NextResponse.json({ error: 'Account not set up for portal login. Contact administrator.' }, { status: 401 });
      }

      const isValid = await verifyPassword(password, partner.passwordHash);

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      const payload: PartnerLoginJwtPayload = {
        partnerId: partner.id,
        role: 'DELIVERY_PARTNER'
      };

      const token = await signToken(payload, '7d');

      const response = NextResponse.json({ success: true, user: { id: partner.id, name: partner.companyName, role: 'DELIVERY_PARTNER' } });
      
      response.cookies.set({
        name: 'token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return response;
    }

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
