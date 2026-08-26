import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'supersecretkey_change_in_production'
);

export interface UserJwtPayload {
  userId: number;
  tenantId: number | null;
  role: string;
}

export interface PartnerJwtPayload {
  partnerId: number;
  deliveryOrderId: number;
  tokenHash: string;
  type: 'PARTNER_INVITE';
}

export interface DriverJwtPayload {
  assignmentId: number;
  deliveryOrderId: number;
  type: 'DRIVER_ACCESS';
}

export interface PartnerLoginJwtPayload {
  partnerId: number;
  role: 'DELIVERY_PARTNER';
}

export type AppJwtPayload = (UserJwtPayload | PartnerJwtPayload | DriverJwtPayload | PartnerLoginJwtPayload) & { [key: string]: unknown };

export async function signToken(payload: any, expiresIn: string = '1d'): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AppJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as AppJwtPayload;
  } catch (error) {
    return null;
  }
}
