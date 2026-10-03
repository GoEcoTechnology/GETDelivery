import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryBatches } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);
    if (!claims || !claims.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const tenantId = claims.tenantId as number;
    const { id } = await params;
    const batchId = parseInt(id);

    const { batchName } = await request.json();

    if (!batchName) {
      return NextResponse.json({ error: 'Batch name is required' }, { status: 400 });
    }

    await db.update(deliveryBatches)
      .set({ batchNumber: batchName })
      .where(and(
        eq(deliveryBatches.id, batchId),
        eq(deliveryBatches.tenantId, tenantId)
      ));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Rename batch error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
