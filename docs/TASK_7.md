# TASK 7 — Página Pública do Comércio

## Pré-requisito: verificar TASK 6 concluída

```bash
test -f src/app/api/commerce/hours/route.ts && echo "OK: hours API" || echo "FALHOU — rode TASK 6"
test -f src/components/dashboard/hours-grid.tsx && echo "OK: hours-grid" || echo "FALHOU — rode TASK 6"
test -f src/app/dashboard/horarios/page.tsx && echo "OK: horarios page" || echo "FALHOU — rode TASK 6"
```

Se qualquer check falhar, **pare e execute TASK 6 primeiro**.

Também verifique que existe pelo menos um comércio publicado no banco para testar:
```bash
# No drizzle-kit studio ou via query: SELECT slug FROM commerce WHERE published = 1 LIMIT 1
```

---

## Objetivo
Página estática do comércio com ISR, cardápio renderizado em HTML sanitizado e dados estruturados Schema.org (JSON-LD).

---

## Passos

### 1. Criar `src/components/public/menu-renderer.tsx`

```tsx
import DOMPurify from 'isomorphic-dompurify';
import { markdownToHtmlSync } from '@/lib/markdown';

interface Props {
  content: string;
}

export function MenuRenderer({ content }: Props) {
  const html = markdownToHtmlSync(content);
  const safe = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1','h2','h3','h4','h5','h6',
      'p','br','strong','em','del','code','pre',
      'ul','ol','li',
      'table','thead','tbody','tr','th','td',
      'img','a','blockquote','hr',
    ],
    ALLOWED_ATTR: ['src','alt','href','title','class'],
    ALLOW_DATA_ATTR: false,
  });

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
```

> **Nota**: instale `isomorphic-dompurify` ao invés de `dompurify` puro (funciona no servidor):
> ```bash
> npm install isomorphic-dompurify
> npm install -D @types/isomorphic-dompurify
> ```
> Atualize `src/lib/markdown.ts` para importar de `isomorphic-dompurify` se necessário.

### 2. Criar `src/components/public/commerce-schema.tsx` — JSON-LD

```tsx
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
```

### 3. Criar `src/lib/haversine.ts`

```ts
/**
 * Distância em km entre dois pontos (lat/lng) pela fórmula de Haversine.
 */
export function haversine(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

### 4. Criar página pública `src/app/comercio/[slug]/page.tsx`

```tsx
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
  const published = await db.query.commerces.findMany({
    where: eq(commerces.published, true),
    columns: { slug: true },
  });
  return published.map((c) => ({ slug: c.slug }));
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
```

### 5. Adicionar `@tailwindcss/typography` para estilizar o Markdown renderizado

```bash
npm install -D @tailwindcss/typography
```

Edite `tailwind.config.ts` (ou `tailwind.config.js`) para adicionar o plugin:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  // ... configuração existente ...
  plugins: [
    require('@tailwindcss/typography'),
    // ... outros plugins ...
  ],
};

export default config;
```

### 6. Configurar `next.config.ts` para ISR dinâmico

No arquivo `next.config.ts`, certifique-se que o config padrão está correto. A revalidação é feita via `revalidatePath` nas API routes (já implementado nas tasks 4 e 5), então não precisa de `revalidate` estático aqui.

---

## Verificação ✅

Execute e confirme **todos** os itens antes de chamar TASK_8:

- [ ] `npm run dev` sem erros
- [ ] `/comercio/[slug]` renderiza com o nome do comércio, endereço e categorias
- [ ] Logo aparece (se houver) com `<Image>` do Next.js
- [ ] Cardápio é renderizado como HTML estilizado (tabelas, listas, etc.)
- [ ] Contato com link do WhatsApp funcional
- [ ] Horários de funcionamento exibidos
- [ ] Inspecionar `<head>` no browser → `<script type="application/ld+json">` com dados do comércio
- [ ] Acessar comércio não publicado → 404
- [ ] `npm run build` (opcional) → `generateStaticParams` gera as páginas publicadas

---

## Arquivos criados nesta task
- `src/components/public/menu-renderer.tsx`
- `src/components/public/commerce-schema.tsx`
- `src/lib/haversine.ts`
- `src/app/comercio/[slug]/page.tsx`
- `tailwind.config.ts` (plugin typography adicionado)
