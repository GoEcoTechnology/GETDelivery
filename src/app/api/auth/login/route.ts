import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, deliveryPartners } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
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

    // Normalize the username to search both formats (09... and +639...)
    let alternateUsername = username;
    if (username.startsWith('09')) {
      alternateUsername = '+63' + username.substring(1);
    } else if (username.startsWith('+639')) {
      alternateUsername = '0' + username.substring(3);
    }

    // 1. Authenticate as User (Admin / Tenant / Platform Owner)
    let [user] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, username),
          eq(users.contactNumber, username),
          eq(users.contactNumber, alternateUsername)
        )
      );

    if (user) {
      if (user.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Inactive account' }, { status: 401 });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Incorrect password. Please try again.', code: 'WRONG_PASSWORD' }, { status: 401 });
      }

      const payload: UserJwtPayload = {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
      };

      const token = await signToken(payload, '7d');
      const response = NextResponse.json({
        success: true,
        token,
        user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId }
      });
      
      response.cookies.set({
        name: 'token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    }

    // 2. Authenticate as Delivery Partner
    const [partner] = await db
      .select()
      .from(deliveryPartners)
      .where(
        or(
          eq(deliveryPartners.email, username),
          eq(deliveryPartners.mobileNumber, username),
          eq(deliveryPartners.mobileNumber, alternateUsername)
        )
      );

    if (partner) {
      if (partner.status === 'PENDING') {
        return NextResponse.json({ error: 'Your account is pending Super Admin approval. Please wait for approval before logging in.' }, { status: 403 });
      }

      if (partner.status === 'REJECTED') {
        return NextResponse.json({ error: 'Your registration has been rejected. Please contact support.' }, { status: 403 });
      }

      if (!partner.passwordHash) {
        // First-time login: Set the default password to 123123
        const { hashPassword } = await import('@/lib/password');
        const defaultHash = await hashPassword('123123');
        await db.update(deliveryPartners)
          .set({ passwordHash: defaultHash })
          .where(eq(deliveryPartners.id, partner.id));
        partner.passwordHash = defaultHash;
      }

      const isValid = await verifyPassword(password, partner.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Incorrect password. Your default password is 123123 unless you have changed it.', code: 'WRONG_PASSWORD' }, { status: 401 });
      }

      const payload: PartnerLoginJwtPayload = {
        partnerId: partner.id,
        role: 'DELIVERY_PARTNER'
      };

      const token = await signToken(payload, '7d');
      const response = NextResponse.json({
        success: true,
        token,
        user: { id: partner.id, name: partner.companyName, role: 'DELIVERY_PARTNER' }
      });
      
      response.cookies.set({
        name: 'token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    }

    // If neither user nor partner found
    return NextResponse.json({ error: 'No account found with that email or mobile number. Please check your credentials or register.', code: 'USER_NOT_FOUND' }, { status: 401 });

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
