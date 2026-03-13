import { notFound } from 'next/navigation';
import { db } from '@/db';
import { commerces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ListingIntro } from '@/components/public/listing-intro';
import { CommerceCard } from '@/components/public/commerce-card';
import { getPublishedCommercesByCity } from '@/lib/queries';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ estado: string; cidade: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { estado, cidade } = await params;
  const { city, commerceList } = await getPublishedCommercesByCity(cidade);
  if (!city) return {};

  const stateUpper = estado.toUpperCase();
  return {
    title: `Comércios em ${city.name}, ${stateUpper}`,
    description: `Encontre restaurantes e comércios em ${city.name}, ${stateUpper}. Veja cardápios, horários e formas de atendimento. ${commerceList.length} estabelecimentos.`,
    alternates: {
      canonical: `/restaurantes/${estado}/${cidade}`,
    },
  };
}

export async function generateStaticParams() {
  try {
    // Gera apenas cidades com ao menos 1 comércio publicado
    const result = await db
      .select({ cityId: commerces.cityId })
      .from(commerces)
      .where(eq(commerces.published, true))
      .groupBy(commerces.cityId);

    const cityIds = result.map((r) => r.cityId).filter(Boolean) as string[];
    if (cityIds.length === 0) return [];

    const citiesData = await db.query.cities.findMany({
      where: (c, { inArray }) => inArray(c.id, cityIds),
      columns: { slug: true, state: true },
    });

    return citiesData.map((c) => ({
      estado: c.state.toLowerCase(),
      cidade: c.slug,
    }));
  } catch {
    return [];
  }
}

export const dynamicParams = true; // fallback blocking para novas combinações

export default async function CidadePage({ params }: Props) {
  const { estado, cidade } = await params;
  const { city, commerceList } = await getPublishedCommercesByCity(cidade);

  if (!city || city.state.toLowerCase() !== estado.toLowerCase()) notFound();
  if (commerceList.length === 0) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <ListingIntro
        cityName={city.name}
        state={city.state}
        count={commerceList.length}
      />

      <div className="space-y-3">
        {commerceList.map((commerce) => (
          <CommerceCard key={commerce.id} commerce={commerce} />
        ))}
      </div>
    </div>
  );
}
