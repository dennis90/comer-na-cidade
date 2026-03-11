import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { commerces, menus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { revalidatePath } from 'next/cache';

const menuSchema = z.object({
  content: z.string().max(50000),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (!commerce) return NextResponse.json({ menu: null });

  const menu = await db.query.menus.findFirst({
    where: eq(menus.commerceId, commerce.id),
  });

  return NextResponse.json({ menu });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
    with: { city: true },
  });
  if (!commerce) return NextResponse.json({ error: 'Commerce not found' }, { status: 404 });

  const body = await req.json();
  const parsed = menuSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await db.query.menus.findFirst({
    where: eq(menus.commerceId, commerce.id),
  });

  if (existing) {
    await db.update(menus)
      .set({ content: parsed.data.content, updatedAt: new Date() })
      .where(eq(menus.commerceId, commerce.id));
  } else {
    await db.insert(menus).values({
      id: createId(),
      commerceId: commerce.id,
      content: parsed.data.content,
    });
  }

  revalidatePath(`/comercio/${commerce.slug}`);

  if (commerce.published && commerce.city) {
    const state = commerce.city.state.toLowerCase();
    const citySlug = commerce.city.slug;
    revalidatePath(`/restaurantes/${state}/${citySlug}`);
  }

  return NextResponse.json({ ok: true });
}
