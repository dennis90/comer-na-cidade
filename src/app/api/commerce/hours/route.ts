import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { commerces, operatingHours } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

const hourSchema = z.object({
  // Array completo de 7 dias (alguns podem ser null = fechado)
  hours: z.array(
    z.union([
      z.null(),
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        opensAt: z.string().regex(/^\d{2}:\d{2}$/),
        closesAt: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    ])
  ).length(7),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (!commerce) return NextResponse.json({ hours: [] });

  const hours = await db.query.operatingHours.findMany({
    where: eq(operatingHours.commerceId, commerce.id),
    orderBy: (h, { asc }) => asc(h.dayOfWeek),
  });

  return NextResponse.json({ hours });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (!commerce) return NextResponse.json({ error: 'Commerce not found' }, { status: 404 });

  const body = await req.json();
  const parsed = hourSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Replace all hours for this commerce
  await db.delete(operatingHours).where(eq(operatingHours.commerceId, commerce.id));

  const toInsert = parsed.data.hours
    .filter((h) => h !== null)
    .map((h) => ({
      id: createId(),
      commerceId: commerce.id,
      dayOfWeek: h!.dayOfWeek,
      opensAt: h!.opensAt,
      closesAt: h!.closesAt,
    }));

  if (toInsert.length > 0) {
    await db.insert(operatingHours).values(toInsert);
  }

  return NextResponse.json({ ok: true, saved: toInsert.length });
}
