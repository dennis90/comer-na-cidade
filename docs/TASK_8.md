# TASK 8 — Páginas de Listagem (SEO Programático)

## Pré-requisito: verificar TASK 7 concluída

```bash
test -f src/app/comercio/\[slug\]/page.tsx && echo "OK: commerce page" || echo "FALHOU — rode TASK 7"
test -f src/components/public/menu-renderer.tsx && echo "OK: menu-renderer" || echo "FALHOU — rode TASK 7"
test -f src/components/public/commerce-schema.tsx && echo "OK: commerce-schema" || echo "FALHOU — rode TASK 7"
```

Se qualquer check falhar, **pare e execute TASK 7 primeiro**.

---

## Objetivo
Páginas estáticas de listagem por cidade e por cidade × categoria — alvo das SERPs locais. Com `generateStaticParams` para combinações com comércios publicados e fallback `blocking` para novas combinações.

---

## Passos

### 1. Criar `src/components/public/commerce-card.tsx`

```tsx
import Link from 'next/link';
import Image from 'next/image';
import type { Commerce, City, Category } from '@/db/schema';

interface Props {
  commerce: Commerce & {
    city: City | null;
    categories: Category[];
    modalities: string[];
  };
}

const MODALITY_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  dine_in: 'Local',
  takeout: 'Retirada',
};

export function CommerceCard({ commerce }: Props) {
  return (
    <Link
      href={`/comercio/${commerce.slug}`}
      className="flex items-start gap-4 rounded-xl border bg-white p-4 hover:border-gray-400 transition-colors"
    >
      {commerce.logoUrl ? (
        <Image
          src={commerce.logoUrl}
          alt={`Logo de ${commerce.name}`}
          width={56}
          height={56}
          className="rounded-lg object-cover border flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xl">
          🍽
        </div>
      )}
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{commerce.name}</h3>
        {commerce.city && (
          <p className="text-xs text-gray-500 mt-0.5">
            {commerce.city.name}, {commerce.city.state}
          </p>
        )}
        {commerce.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{commerce.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {commerce.categories.map((cat) => (
            <span key={cat.id} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
              {cat.name}
            </span>
          ))}
          {commerce.modalities.map((mod) => (
            <span key={mod} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {MODALITY_LABELS[mod] ?? mod}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
```

### 2. Criar `src/components/public/listing-intro.tsx`

```tsx
interface Props {
  categoryName?: string;
  cityName: string;
  state: string;
  count: number;
}

export function ListingIntro({ categoryName, cityName, state, count }: Props) {
  const subject = categoryName ?? 'estabelecimentos';

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold mb-3">
        {categoryName ? `${categoryName} em ${cityName}, ${state}` : `Comércios em ${cityName}, ${state}`}
      </h1>
      <p className="text-gray-600 max-w-2xl">
        Encontre {subject.toLowerCase()} em {cityName}, {state}.
        Veja cardápios, horários de funcionamento e formas de atendimento —
        entrega, consumo no local ou retirada.
        {count > 0 && ` ${count} estabelecimento${count !== 1 ? 's' : ''} cadastrado${count !== 1 ? 's' : ''}.`}
      </p>
    </div>
  );
}
```

### 3. Criar `src/lib/queries.ts` — queries reutilizáveis para listagens

```ts
import { db } from '@/db';
import { commerces, cities, categories, commerceCategories, commerceModalities } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function getPublishedCommercesByCity(citySlug: string, categorySlug?: string) {
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
```

### 4. Criar página de listagem por cidade `src/app/restaurantes/[estado]/[cidade]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { cities, commerces } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ListingIntro } from '@/components/public/listing-intro';
import { CommerceCard } from '@/components/public/commerce-card';
import { getPublishedCommercesByCity } from '@/lib/queries';
import type { Metadata } from 'next';
import Link from 'next/link';

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
```

### 5. Criar página de listagem por cidade × categoria `src/app/restaurantes/[estado]/[cidade]/[categoria]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { commerces, commerceCategories, categories, cities } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
```

---

## Verificação ✅

Execute e confirme **todos** os itens antes de chamar TASK_9:

- [ ] `npm run dev` sem erros de TypeScript
- [ ] `/restaurantes/sp/ituverava` (ou cidade real com comércio) → lista comércios
- [ ] `/restaurantes/sp/ituverava/pizzaria` → lista comércios dessa categoria nessa cidade
- [ ] URL com cidade inexistente → 404
- [ ] URL com categoria sem comércio → 404
- [ ] `<title>` da página de listagem está no formato correto ("Pizzaria em Ituverava, SP")
- [ ] `<meta name="description">` com quantidade de estabelecimentos
- [ ] JSON-LD ItemList visível no `<head>` da página de categoria
- [ ] Breadcrumb (cidade › categoria) aparece na página de categoria
- [ ] `npm run build` (opcional) → `generateStaticParams` gera as combinações corretas

---

## Arquivos criados nesta task
- `src/components/public/commerce-card.tsx`
- `src/components/public/listing-intro.tsx`
- `src/lib/queries.ts`
- `src/app/restaurantes/[estado]/[cidade]/page.tsx`
- `src/app/restaurantes/[estado]/[cidade]/[categoria]/page.tsx`
