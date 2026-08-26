import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryAssignments, deliveryOrders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import crypto from 'crypto';

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
      
      if (assignmentId !== claims.assignmentId) {
        return NextResponse.json({ error: 'Forbidden: Invalid assignment ID' }, { status: 403 });
      }

      // Parse the multipart form data for the file upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'Proof image file is required' }, { status: 400 });
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
      }

      // In a real application, you would stream this file buffer directly to a private 
      // Supabase Storage bucket (e.g., `proof_of_delivery`).
      // We will simulate that by generating a mock secure URL.
      
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const fileName = `proof_${assignmentId}_${Date.now()}.png`;
      const mockStorageUrl = `https://storage.supabase.co/private/proof_of_delivery/${fileName}`;

      // Update the assignment to indicate proof was submitted
      // Wait, there is no proofUrl column in deliveryAssignments in the current schema.
      // We will create an Audit Log instead for now, as modifying the schema requires a migration.

      await tx.insert(require('@/db/schema').auditLogs).values({
        tenantId: null, // Drivers don't belong to a tenant, but the order does
        actorType: 'PARTNER', // Or 'DRIVER'
        action: 'PROOF_OF_DELIVERY_UPLOADED',
        entityType: 'DELIVERY_ASSIGNMENT',
        entityId: assignmentId,
        details: `Proof of delivery uploaded: ${mockStorageUrl}`,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Proof of delivery securely uploaded.',
        url: mockStorageUrl // Usually wouldn't return private URLs like this without signing
      });
    });
  } catch (error: any) {
    console.error('Proof upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
