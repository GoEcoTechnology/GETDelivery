import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, UserJwtPayload } from './lib/auth';

// Paths that do not require authentication
const publicPaths = ['/api/auth/login', '/login', '/api/invite', '/invite'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public paths and static files
  if (
    publicPaths.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Expect token in Authorization header (Bearer token) or a cookie named 'token'
  let token = request.cookies.get('token')?.value;

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const headerToken = authHeader.substring(7).trim();
    if (headerToken) {
      token = headerToken;
    }
  }

  if (!token) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);

  if (!payload) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
    }
    // Clear invalid token cookie and redirect
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }

  // Validate specific route requirements
  if (pathname.startsWith('/api/users') || pathname.startsWith('/api/tenants')) {
    if ((payload as any).role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Pass claims to backend API via headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String((payload as any).userId || ''));
  requestHeaders.set('x-user-role', String((payload as any).role || ''));
  
  if ((payload as any).tenantId) {
    requestHeaders.set('x-tenant-id', String((payload as any).tenantId));
  }
  if ((payload as any).partnerId) {
    requestHeaders.set('x-partner-id', String((payload as any).partnerId));
    requestHeaders.set('x-access-type', String((payload as any).type));
  }
  if ((payload as any).assignmentId) {
    requestHeaders.set('x-assignment-id', String((payload as any).assignmentId));
    requestHeaders.set('x-delivery-order-id', String((payload as any).deliveryOrderId));
    requestHeaders.set('x-access-type', String((payload as any).type));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
