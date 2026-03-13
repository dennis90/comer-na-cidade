import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { commerces, commerceCategories, commerceModalities, operatingHours, menus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { slugify } from '@/lib/slugify';
import { isPublishable } from '@/lib/completeness';
import { revalidatePath } from 'next/cache';

const commerceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  address: z.string().max(300).optional(),
  cityId: z.string().transform((v) => v || undefined).optional(),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  instagram: z.string().max(100).optional(),
  categoryIds: z.array(z.string()).optional(),
  modalities: z.array(z.object({
    modality: z.enum(['delivery', 'dine_in', 'takeout']),
    deliveryRadiusKm: z.number().optional(),
  })).optional(),
  published: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
    with: {
      commerceCategories: { with: { category: true } },
      commerceModalities: true,
      menu: true,
      operatingHours: true,
    },
  });

  return NextResponse.json({ commerce });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // One commerce per user
  const existing = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (existing) return NextResponse.json({ error: 'Commerce already exists' }, { status: 409 });

  const body = await req.json();
  const parsed = commerceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const id = createId();
  const slug = slugify(`${data.name}-${id.slice(0, 6)}`);

  await db.insert(commerces).values({
    id,
    slug,
    name: data.name,
    description: data.description,
    address: data.address,
    cityId: data.cityId,
    phone: data.phone,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    ownerId: session.user.id,
  });

  if (data.categoryIds?.length) {
    await db.insert(commerceCategories).values(
      data.categoryIds.map((catId) => ({ commerceId: id, categoryId: catId }))
    );
  }

  if (data.modalities?.length) {
    await db.insert(commerceModalities).values(
      data.modalities.map((m) => ({ commerceId: id, ...m }))
    );
  }

  return NextResponse.json({ id, slug }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (!commerce) return NextResponse.json({ error: 'Commerce not found' }, { status: 404 });

  const body = await req.json();
  const parsed = commerceSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  // Handle publish toggle separately with completeness check
  if (data.published !== undefined) {
    if (data.published) {
      const [cats, mods, hours, menu] = await Promise.all([
        db.query.commerceCategories.findMany({ where: eq(commerceCategories.commerceId, commerce.id) }),
        db.query.commerceModalities.findMany({ where: eq(commerceModalities.commerceId, commerce.id) }),
        db.query.operatingHours.findMany({ where: eq(operatingHours.commerceId, commerce.id) }),
        db.query.menus.findFirst({ where: eq(menus.commerceId, commerce.id) }),
      ]);
      const ok = isPublishable({ commerce, menu: menu ?? null, hours, categoryCount: cats.length, modalityCount: mods.length });
      if (!ok) return NextResponse.json({ error: 'Commerce is not ready to publish' }, { status: 422 });
    }
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.cityId !== undefined) updateData.cityId = data.cityId;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp;
  if (data.instagram !== undefined) updateData.instagram = data.instagram;
  if (data.published !== undefined) updateData.published = data.published;

  await db.update(commerces).set(updateData).where(eq(commerces.id, commerce.id));

  if (data.categoryIds !== undefined) {
    await db.delete(commerceCategories).where(eq(commerceCategories.commerceId, commerce.id));
    if (data.categoryIds.length) {
      await db.insert(commerceCategories).values(
        data.categoryIds.map((catId) => ({ commerceId: commerce.id, categoryId: catId }))
      );
    }
  }

  if (data.modalities !== undefined) {
    await db.delete(commerceModalities).where(eq(commerceModalities.commerceId, commerce.id));
    if (data.modalities.length) {
      await db.insert(commerceModalities).values(
        data.modalities.map((m) => ({ commerceId: commerce.id, ...m }))
      );
    }
  }

  // Revalidate public pages if published state changed
  if (data.published !== undefined) {
    revalidatePath(`/comercio/${commerce.slug}`);
  }

  return NextResponse.json({ ok: true });
}
