import type { DrizzleD1 } from '@/db';
import { commerces, cities, categories, commerceCategories, commerceModalities } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function getPublishedCommercesByCity(db: DrizzleD1, citySlug: string, categorySlug?: string) {
  const city = await db.query.cities.findFirst({
    where: eq(cities.slug, citySlug),
  });
  if (!city) return { city: null, commerceList: [] };

  // Se tem categoria, filtrar os commerces que têm essa categoria
  let commerceIds: string[] | undefined;
  if (categorySlug) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.slug, categorySlug),
    });
    if (!cat) return { city, category: null, commerceList: [] };

    const links = await db.query.commerceCategories.findMany({
      where: eq(commerceCategories.categoryId, cat.id),
      columns: { commerceId: true },
    });
    commerceIds = links.map((l) => l.commerceId);
    if (commerceIds.length === 0) return { city, category: cat, commerceList: [] };

    const list = await db.query.commerces.findMany({
      where: and(
        eq(commerces.published, true),
        eq(commerces.cityId, city.id),
        inArray(commerces.id, commerceIds)
      ),
      with: {
        city: true,
        commerceCategories: { with: { category: true } },
        commerceModalities: true,
      },
    });

    return {
      city,
      category: cat,
      commerceList: list.map((c) => ({
        ...c,
        categories: c.commerceCategories.map((cc) => cc.category),
        modalities: c.commerceModalities.map((m) => m.modality),
      })),
    };
  }

  const list = await db.query.commerces.findMany({
    where: and(eq(commerces.published, true), eq(commerces.cityId, city.id)),
    with: {
      city: true,
      commerceCategories: { with: { category: true } },
      commerceModalities: true,
    },
  });

  return {
    city,
    category: undefined,
    commerceList: list.map((c) => ({
      ...c,
      categories: c.commerceCategories.map((cc) => cc.category),
      modalities: c.commerceModalities.map((m) => m.modality),
    })),
  };
}
