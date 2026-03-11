import { notFound } from 'next/navigation';
import { db } from '@/db';
import { commerces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Image from 'next/image';
import { MenuRenderer } from '@/components/public/menu-renderer';
import { CommerceSchema } from '@/components/public/commerce-schema';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

async function getCommerce(slug: string) {
  return db.query.commerces.findFirst({
    where: eq(commerces.slug, slug),
    with: {
      city: true,
      commerceCategories: { with: { category: true } },
      commerceModalities: true,
      operatingHours: true,
      menu: true,
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const commerce = await getCommerce(slug);
  if (!commerce) return {};

  const city = commerce.city ? `${commerce.city.name}, ${commerce.city.state}` : '';
  const categories = commerce.commerceCategories?.map((cc) => cc.category.name).join(', ');

  return {
    title: `${commerce.name}${city ? ` — ${city}` : ''}`,
    description: commerce.description?.slice(0, 160) ?? `${categories} em ${city}`,
    openGraph: {
      title: commerce.name,
      description: commerce.description?.slice(0, 160) ?? '',
      ...(commerce.logoUrl && { images: [commerce.logoUrl] }),
    },
  };
}

export async function generateStaticParams() {
  try {
    const published = await db.query.commerces.findMany({
      where: eq(commerces.published, true),
      columns: { slug: true },
    });
    return published.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MODALITY_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  dine_in: 'Consumo no local',
  takeout: 'Retirada',
};

export default async function ComercioPage({ params }: Props) {
  const { slug } = await params;
  const commerce = await getCommerce(slug);

  if (!commerce || !commerce.published) notFound();

  const categories = commerce.commerceCategories?.map((cc) => cc.category) ?? [];
  const hours = commerce.operatingHours ?? [];
  const modalities = commerce.commerceModalities ?? [];

  return (
    <>
      <CommerceSchema
        commerce={{ ...commerce, city: commerce.city ?? null, categories, hours }}
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          {commerce.logoUrl && (
            <Image
              src={commerce.logoUrl}
              alt={`Logo de ${commerce.name}`}
              width={80}
              height={80}
              className="rounded-xl object-cover border"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold">{commerce.name}</h1>
            {commerce.city && (
              <p className="text-gray-500 text-sm mt-1">
                {commerce.address && `${commerce.address} · `}
                {commerce.city.name}, {commerce.city.state}
              </p>
            )}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {categories.map((cat) => (
                  <span key={cat.id} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                    {cat.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {commerce.description && (
          <p className="text-gray-700 mb-6">{commerce.description}</p>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Contact */}
          {(commerce.phone || commerce.whatsapp || commerce.instagram) && (
            <div className="rounded-lg border p-4 space-y-2">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">Contato</h2>
              {commerce.phone && <p className="text-sm">📞 {commerce.phone}</p>}
              {commerce.whatsapp && (
                <p className="text-sm">
                  💬{' '}
                  <a
                    href={`https://wa.me/55${commerce.whatsapp.replace(/\D/g, '')}`}
                    className="underline text-green-700"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {commerce.whatsapp}
                  </a>
                </p>
              )}
              {commerce.instagram && (
                <p className="text-sm">
                  📷{' '}
                  <a
                    href={`https://instagram.com/${commerce.instagram.replace('@', '')}`}
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {commerce.instagram}
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Modalities */}
          {modalities.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">Atendimento</h2>
              {modalities.map((m) => (
                <p key={m.modality} className="text-sm">
                  ✓ {MODALITY_LABELS[m.modality] ?? m.modality}
                  {m.modality === 'delivery' && m.deliveryRadiusKm
                    ? ` (raio ${m.deliveryRadiusKm}km)`
                    : ''}
                </p>
              ))}
            </div>
          )}

          {/* Hours */}
          {hours.length > 0 && (
            <div className="rounded-lg border p-4 space-y-1 sm:col-span-2">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2">
                Horários de Funcionamento
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1">
                {hours
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                  .map((h) => (
                    <div key={h.id} className="flex justify-between text-sm gap-4">
                      <span className="text-gray-600">{DAYS_PT[h.dayOfWeek]}</span>
                      <span>{h.opensAt} – {h.closesAt}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Menu */}
        {commerce.menu && (
          <div>
            <h2 className="text-xl font-bold mb-4">Cardápio</h2>
            <MenuRenderer content={commerce.menu.content} />
          </div>
        )}
      </div>
    </>
  );
}
