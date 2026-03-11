import type { Commerce, City, Category, OperatingHours } from '@/db/schema';

const DAY_MAP = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface Props {
  commerce: Commerce & { city: City | null; categories: Category[]; hours: OperatingHours[] };
}

export function CommerceSchema({ commerce }: Props) {
  const openingHours = commerce.hours.map((h) => {
    const day = DAY_MAP[h.dayOfWeek];
    return `${day} ${h.opensAt}-${h.closesAt}`;
  });

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: commerce.name,
    description: commerce.description ?? undefined,
    telephone: commerce.phone ?? undefined,
    url: `${process.env.NEXT_PUBLIC_APP_URL}/comercio/${commerce.slug}`,
    ...(commerce.logoUrl && { image: commerce.logoUrl }),
    address: {
      '@type': 'PostalAddress',
      streetAddress: commerce.address ?? undefined,
      addressLocality: commerce.city?.name ?? undefined,
      addressRegion: commerce.city?.state ?? undefined,
      addressCountry: 'BR',
    },
    ...(openingHours.length > 0 && { openingHours }),
    ...(commerce.categories.length > 0 && {
      servesCuisine: commerce.categories.map((c) => c.name).join(', '),
    }),
    hasMenu: `${process.env.NEXT_PUBLIC_APP_URL}/comercio/${commerce.slug}`,
    ...(commerce.lat && commerce.lng && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: commerce.lat,
        longitude: commerce.lng,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
