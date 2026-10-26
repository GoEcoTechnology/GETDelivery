import { NextResponse } from 'next/server';
import { db } from '@/db';
import { packageCategories } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  try {
    const categories = await db
      .select()
      .from(packageCategories)
      .orderBy(asc(packageCategories.sortOrder));

    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error('Error fetching package categories:', error);
    return NextResponse.json({ error: 'Failed to fetch package categories' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.manage'] }, async (tx, claims) => {
    try {
      const body = await request.json();
      const { categories } = body;

      if (!Array.isArray(categories)) {
        return NextResponse.json({ error: 'Invalid categories format' }, { status: 400 });
      }

      for (const cat of categories) {
        if (!cat.id && !cat.code) continue;

        const updateData: Record<string, any> = {
          updatedAt: new Date(),
        };

        if (cat.name !== undefined) updateData.name = cat.name;
        if (cat.description !== undefined) updateData.description = cat.description ? String(cat.description) : null;
        if (cat.maxLengthCm !== undefined) updateData.maxLengthCm = cat.maxLengthCm ? String(cat.maxLengthCm) : null;
        if (cat.maxWidthCm !== undefined) updateData.maxWidthCm = cat.maxWidthCm ? String(cat.maxWidthCm) : null;
        if (cat.maxHeightCm !== undefined) updateData.maxHeightCm = cat.maxHeightCm ? String(cat.maxHeightCm) : null;
        if (cat.maxWeightKg !== undefined) updateData.maxWeightKg = cat.maxWeightKg ? String(cat.maxWeightKg) : null;
        if (cat.isActive !== undefined) updateData.isActive = Boolean(cat.isActive);
        if (cat.sortOrder !== undefined) updateData.sortOrder = Number(cat.sortOrder);

        if (cat.id) {
          await tx.update(packageCategories).set(updateData).where(eq(packageCategories.id, Number(cat.id)));
        } else if (cat.code) {
          await tx.update(packageCategories).set(updateData).where(eq(packageCategories.code, cat.code));
        }
      }

      const updated = await tx
        .select()
        .from(packageCategories)
        .orderBy(asc(packageCategories.sortOrder));

      return NextResponse.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error updating package categories:', error);
      return NextResponse.json({ error: 'Failed to update package categories' }, { status: 500 });
    }
  });
}
