import { notFound } from 'next/navigation';
import { db } from '@/db';
import { commerces, commerceCategories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ListingIntro } from '@/components/public/listing-intro';
import { CommerceCard } from '@/components/public/commerce-card';
import { getPublishedCommercesByCity } from '@/lib/queries';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ estado: string; cidade: string; categoria: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { estado, cidade, categoria } = await params;
  const { city, category, commerceList } = await getPublishedCommercesByCity(cidade, categoria);
  if (!city || !category) return {};

  const stateUpper = estado.toUpperCase();
  return {
    title: `${category.name} em ${city.name}, ${stateUpper}`,
    description: `Encontre ${category.name.toLowerCase()} em ${city.name}, ${stateUpper}. Veja cardápios, horários e formas de atendimento. ${commerceList.length} estabelecimento${commerceList.length !== 1 ? 's' : ''}.`,
    alternates: {
      canonical: `/restaurantes/${estado}/${cidade}/${categoria}`,
    },
  };
}

export async function generateStaticParams() {
  try {
  // Gera combinações cidade × categoria com ao menos 1 comércio publicado
  const links = await db
    .select({
      commerceId: commerceCategories.commerceId,
      categoryId: commerceCategories.categoryId,
    })
    .from(commerceCategories)
    .innerJoin(commerces, eq(commerces.id, commerceCategories.commerceId))
    .where(eq(commerces.published, true));

  if (links.length === 0) return [];

  const commerceIds = [...new Set(links.map((l) => l.commerceId))];
  const categoryIds = [...new Set(links.map((l) => l.categoryId))];

  const [citiesData, categoriesData, commercesData] = await Promise.all([
    db.query.cities.findMany({ columns: { id: true, slug: true, state: true } }),
    db.query.categories.findMany({
      where: (c, { inArray }) => inArray(c.id, categoryIds),
      columns: { id: true, slug: true },
    }),
    db.query.commerces.findMany({
      where: (c, { inArray }) => inArray(c.id, commerceIds),
      columns: { id: true, cityId: true },
    }),
  ]);

  const citiesMap = Object.fromEntries(citiesData.map((c) => [c.id, c]));
  const categoriesMap = Object.fromEntries(categoriesData.map((c) => [c.id, c]));
  const commercesMap = Object.fromEntries(commercesData.map((c) => [c.id, c]));

  const combos = new Set<string>();
  const result: { estado: string; cidade: string; categoria: string }[] = [];

  for (const link of links) {
    const commerce = commercesMap[link.commerceId];
    const city = commerce?.cityId ? citiesMap[commerce.cityId] : null;
    const category = categoriesMap[link.categoryId];
    if (!city || !category) continue;

    const key = `${city.slug}:${category.slug}`;
    if (!combos.has(key)) {
      combos.add(key);
      result.push({
        estado: city.state.toLowerCase(),
        cidade: city.slug,
        categoria: category.slug,
      });
    }
  }

  return result;
  } catch {
    return [];
  }
}

export const dynamicParams = true;

export default async function CidadeCategoriaPagina({ params }: Props) {
  const { estado, cidade, categoria } = await params;
  const { city, category, commerceList } = await getPublishedCommercesByCity(cidade, categoria);

  if (!city || city.state.toLowerCase() !== estado.toLowerCase()) notFound();
  if (!category) notFound();
  if (commerceList.length === 0) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <a href={`/restaurantes/${estado}/${cidade}`} className="hover:underline">
          {city.name}
        </a>
        {' › '}
        <span>{category.name}</span>
      </nav>

      <ListingIntro
        categoryName={category.name}
        cityName={city.name}
        state={city.state}
        count={commerceList.length}
      />

      {/* Schema.org ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `${category.name} em ${city.name}, ${city.state}`,
            numberOfItems: commerceList.length,
            itemListElement: commerceList.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${process.env.NEXT_PUBLIC_APP_URL}/comercio/${c.slug}`,
              name: c.name,
            })),
          }),
        }}
      />

      <div className="space-y-3">
        {commerceList.map((commerce) => (
          <CommerceCard key={commerce.id} commerce={commerce} />
        ))}
      </div>
    </div>
  );
}
