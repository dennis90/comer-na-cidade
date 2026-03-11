import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { cities } from '@/db/schema';
import { like } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ cities: [] });

  // Normalizar busca: remover acentos para comparação insensível
  const term = q
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // LibSQL/SQLite: busca por nome (LIKE, case-insensitive para ASCII)
  // Para acentos funcionar bem, buscamos também pelo slug (já normalizado)
  const results = await db.query.cities.findMany({
    where: like(cities.slug, `${term.replace(/\s+/g, '-')}%`),
    orderBy: (c, { asc }) => asc(c.name),
    limit: 8,
    columns: { id: true, slug: true, name: true, state: true },
  });

  // Se poucos resultados via slug, busca também por nome contendo
  if (results.length < 4) {
    const byName = await db.query.cities.findMany({
      where: like(cities.slug, `%${term.replace(/\s+/g, '-')}%`),
      orderBy: (c, { asc }) => asc(c.name),
      limit: 8,
      columns: { id: true, slug: true, name: true, state: true },
    });
    // Merge sem duplicatas
    const seen = new Set(results.map((r) => r.id));
    for (const r of byName) {
      if (!seen.has(r.id)) results.push(r);
    }
  }

  return NextResponse.json({ cities: results.slice(0, 8) });
}
