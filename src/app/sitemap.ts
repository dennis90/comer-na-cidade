import { MetadataRoute } from 'next';
import { getDb } from '@/db';
import { commerces } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://comernacidade.com.br';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Home
  entries.push({
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1.0,
  });

  try {
    const db = await getDb();
    // Páginas de comércio individuais
    const publishedCommerces = await db.query.commerces.findMany({
      where: eq(commerces.published, true),
      columns: { slug: true, updatedAt: true },
    });

    for (const c of publishedCommerces) {
      entries.push({
        url: `${BASE_URL}/comercio/${c.slug}`,
        lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    // Páginas de listagem por cidade
    const publishedWithCity = await db.query.commerces.findMany({
      where: and(eq(commerces.published, true)),
      columns: { cityId: true },
      with: { city: true },
    });

    const citySet = new Map<string, { slug: string; state: string }>();
    for (const c of publishedWithCity) {
      if (c.city && !citySet.has(c.city.id)) {
        citySet.set(c.city.id, { slug: c.city.slug, state: c.city.state });
      }
    }

    for (const [, city] of citySet) {
      entries.push({
        url: `${BASE_URL}/restaurantes/${city.state.toLowerCase()}/${city.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.7,
      });
    }

    // Páginas de listagem por cidade × categoria
    const links = await db.query.commerceCategories.findMany({
      with: {
        commerce: { with: { city: true } },
        category: true,
      },
    });

    const comboSet = new Set<string>();
    for (const link of links) {
      if (!link.commerce?.published || !link.commerce?.city) continue;
      const city = link.commerce.city;
      const cat = link.category;
      const key = `${city.state.toLowerCase()}/${city.slug}/${cat.slug}`;
      if (!comboSet.has(key)) {
        comboSet.add(key);
        entries.push({
          url: `${BASE_URL}/restaurantes/${key}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch {
    // DB not available at build time; return just the home entry
  }

  return entries;
}
