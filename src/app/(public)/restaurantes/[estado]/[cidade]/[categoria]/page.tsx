import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { ListingIntro } from '@/components/public/listing-intro';
import { CommerceCard } from '@/components/public/commerce-card';
import { getPublishedCommercesByCity } from '@/lib/queries';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ estado: string; cidade: string; categoria: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { estado, cidade, categoria } = await params;
  const { city, category, commerceList } = await getPublishedCommercesByCity(await getDb(), cidade, categoria);
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

export const dynamic = 'force-dynamic';

export default async function CidadeCategoriaPagina({ params }: Props) {
  const { estado, cidade, categoria } = await params;
  const { city, category, commerceList } = await getPublishedCommercesByCity(await getDb(), cidade, categoria);

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
