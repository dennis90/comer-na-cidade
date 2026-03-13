import { notFound } from 'next/navigation';
import { getDb } from '@/db';
import { ListingIntro } from '@/components/public/listing-intro';
import { CommerceCard } from '@/components/public/commerce-card';
import { getPublishedCommercesByCity } from '@/lib/queries';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ estado: string; cidade: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { estado, cidade } = await params;
  const { city, commerceList } = await getPublishedCommercesByCity(await getDb(), cidade);
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

export const dynamic = 'force-dynamic';

export default async function CidadePage({ params }: Props) {
  const { estado, cidade } = await params;
  const { city, commerceList } = await getPublishedCommercesByCity(await getDb(), cidade);

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
