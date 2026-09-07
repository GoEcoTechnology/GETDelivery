import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

// Public paths - never require auth
const publicPaths = [
  '/login',
  '/register',
  '/invite',
  '/api/auth/login',
  '/api/auth/register',
  '/api/invite',
];

// Page route sections restricted by role
const routeRoles: { prefix: string; roles: string[] }[] = [
  { prefix: '/admin',          roles: ['BUSINESS_OWNER', 'EMPLOYEE', 'PLATFORM_OWNER'] },
  { prefix: '/platform-admin', roles: ['PLATFORM_OWNER'] },
  { prefix: '/partner',        roles: ['DELIVERY_PARTNER'] },
  { prefix: '/driver',         roles: ['DRIVER'] },
];

function getRedirectForRole(role: string): string {
  if (role === 'DELIVERY_PARTNER') return '/partner/orders';
  if (role === 'PLATFORM_OWNER')   return '/platform-admin';
  if (role === 'DRIVER')           return '/driver';
  return '/admin/dashboard';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always skip static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Always allow public paths
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // --- Determine if this path needs auth ---
  const isPageRoute = routeRoles.some(r => pathname.startsWith(r.prefix));
  const isApiRoute  = pathname.startsWith('/api/');

  if (!isPageRoute && !isApiRoute) {
    // Root, unknown paths — pass through
    return NextResponse.next();
  }

  // --- Get token: prefer httpOnly cookie, fallback to Authorization header ---
  let token = request.cookies.get('token')?.value;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const headerToken = authHeader.substring(7).trim();
    if (headerToken) token = headerToken;
  }

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);

  if (!payload) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }

  const role = (payload as any).role as string;

  // --- Page-level role guard ---
  if (isPageRoute) {
    for (const rule of routeRoles) {
      if (pathname.startsWith(rule.prefix)) {
        if (!rule.roles.includes(role)) {
          return NextResponse.redirect(new URL(getRedirectForRole(role), request.url));
        }
        break;
      }
    }
  }

  // --- Sensitive API-level role guard ---
  if (pathname.startsWith('/api/users') || pathname.startsWith('/api/tenants')) {
    if (role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // --- Inject claims into request headers for API handlers ---
  const requestHeaders = new Headers(request.headers);

  const pType = (payload as any).type as string | undefined;

  if (role) {
    requestHeaders.set('x-user-id',   String((payload as any).userId   || ''));
    requestHeaders.set('x-user-role', String(role));
    if ((payload as any).tenantId)        requestHeaders.set('x-tenant-id',        String((payload as any).tenantId));
    if ((payload as any).partnerId)       requestHeaders.set('x-partner-id',        String((payload as any).partnerId));
  } else if (pType === 'PARTNER_INVITE') {
    requestHeaders.set('x-access-type', 'PARTNER_INVITE');
    requestHeaders.set('x-partner-id',  String((payload as any).partnerId || ''));
  } else if (pType === 'DRIVER_ACCESS') {
    requestHeaders.set('x-access-type',          'DRIVER_ACCESS');
    requestHeaders.set('x-assignment-id',         String((payload as any).assignmentId || ''));
    requestHeaders.set('x-delivery-order-id',     String((payload as any).deliveryOrderId || ''));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
