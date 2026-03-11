# TASK 9 — Home e Busca por Cidade

## Pré-requisito: verificar TASK 8 concluída

```bash
test -f src/components/public/commerce-card.tsx && echo "OK: commerce-card" || echo "FALHOU — rode TASK 8"
test -f "src/app/restaurantes/[estado]/[cidade]/page.tsx" && echo "OK: listing page" || echo "FALHOU — rode TASK 8"
test -f src/lib/queries.ts && echo "OK: queries.ts" || echo "FALHOU — rode TASK 8"
```

Se qualquer check falhar, **pare e execute TASK 8 primeiro**.

---

## Objetivo
Visitante encontra comércios pela home com busca por cidade (autocomplete). Digitar a cidade sugere resultados, selecionar redireciona para `/restaurantes/[estado]/[cidade]`.

---

## Passos

### 1. Criar API route `src/app/api/cities/search/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { cities } from '@/db/schema';
import { like, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ cities: [] });

  // Normalizar busca: remover acentos para comparação insensível
  const term = q
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // LibSQL/SQLite: busca por nome (LIKE, case-insensitive para ASCII)
  // Para acentos funcionar bem, buscamos também pelo slug (já normalizado)
  const results = await db.query.cities.findMany({
    where: like(cities.slug, `${term.replace(/\s+/g, '-')}%`),
    orderBy: (c, { asc }) => asc(c.name),
    limit: 8,
    columns: { id: true, slug: true, name: true, state: true },
  });

  // Se poucos resultados via slug, busca também por nome contendo
  if (results.length < 4) {
    const byName = await db.query.cities.findMany({
      where: like(cities.slug, `%${term.replace(/\s+/g, '-')}%`),
      orderBy: (c, { asc }) => asc(c.name),
      limit: 8,
      columns: { id: true, slug: true, name: true, state: true },
    });
    // Merge sem duplicatas
    const seen = new Set(results.map((r) => r.id));
    for (const r of byName) {
      if (!seen.has(r.id)) results.push(r);
    }
  }

  return NextResponse.json({ cities: results.slice(0, 8) });
}
```

### 2. Criar `src/components/public/city-search.tsx`

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

interface CityResult {
  id: string;
  slug: string;
  name: string;
  state: string;
}

export function CitySearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.cities ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query]);

  function select(city: CityResult) {
    setOpen(false);
    setQuery('');
    router.push(`/restaurantes/${city.state.toLowerCase()}/${city.slug}`);
  }

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!inputRef.current?.closest('[data-city-search]')?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div data-city-search className="relative w-full max-w-md">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Digite o nome da cidade..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="h-12 text-base"
        autoComplete="off"
      />

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
          {results.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                onClick={() => select(city)}
              >
                <span className="font-medium">{city.name}</span>
                <span className="text-sm text-gray-400">{city.state}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          ...
        </div>
      )}
    </div>
  );
}
```

### 3. Criar Home `src/app/page.tsx`

```tsx
import { db } from '@/db';
import { commerces, cities, commerceCategories, categories } from '@/db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { CitySearch } from '@/components/public/city-search';
import Link from 'next/link';
import type { Metadata } from 'next';

export const revalidate = 86400; // revalidar a cada 24h

export const metadata: Metadata = {
  title: 'Cardápio Digital — Encontre comércios na sua cidade',
  description:
    'Descubra restaurantes, padarias, lanchonetes e mais na sua cidade. Veja cardápios completos, horários e formas de atendimento.',
};

async function getStats() {
  const [commerceCount, cityCount] = await Promise.all([
    db.select({ count: count() }).from(commerces).where(eq(commerces.published, true)),
    db
      .selectDistinct({ cityId: commerces.cityId })
      .from(commerces)
      .where(eq(commerces.published, true)),
  ]);
  return {
    commerces: commerceCount[0]?.count ?? 0,
    cities: cityCount.length,
  };
}

async function getFeaturedCities() {
  // Cidades com mais comércios publicados
  const result = await db
    .select({
      cityId: commerces.cityId,
      cnt: count(commerces.id),
    })
    .from(commerces)
    .where(eq(commerces.published, true))
    .groupBy(commerces.cityId)
    .orderBy(sql`count(${commerces.id}) desc`)
    .limit(6);

  if (result.length === 0) return [];

  const cityIds = result.map((r) => r.cityId).filter(Boolean) as string[];
  const citiesData = await db.query.cities.findMany({
    where: (c, { inArray }) => inArray(c.id, cityIds),
    columns: { id: true, slug: true, name: true, state: true },
  });

  return citiesData.map((city) => ({
    ...city,
    count: result.find((r) => r.cityId === city.id)?.cnt ?? 0,
  }));
}

async function getCategories() {
  return db.query.categories.findMany({ orderBy: (c, { asc }) => asc(c.name) });
}

export default async function HomePage() {
  const [stats, featuredCities, allCategories] = await Promise.all([
    getStats(),
    getFeaturedCities(),
    getCategories(),
  ]);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-white border-b py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">
            Encontre comércios na sua cidade
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Cardápios completos, horários e formas de atendimento de estabelecimentos locais.
          </p>

          <div className="flex justify-center">
            <CitySearch />
          </div>

          {stats.commerces > 0 && (
            <p className="text-sm text-gray-400 mt-4">
              {stats.commerces} estabelecimento{stats.commerces !== 1 ? 's' : ''} em{' '}
              {stats.cities} cidade{stats.cities !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </section>

      {/* Categorias */}
      {allCategories.length > 0 && (
        <section className="py-12 px-4 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-semibold mb-6">Categorias</h2>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/restaurantes?categoria=${cat.slug}`}
                  className="px-4 py-2 rounded-full border bg-white hover:border-gray-400 transition-colors text-sm"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cidades em destaque */}
      {featuredCities.length > 0 && (
        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-semibold mb-6">Cidades com mais estabelecimentos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {featuredCities.map((city) => (
                <Link
                  key={city.id}
                  href={`/restaurantes/${city.state.toLowerCase()}/${city.slug}`}
                  className="rounded-xl border bg-white p-4 hover:border-gray-400 transition-colors"
                >
                  <p className="font-medium">{city.name}</p>
                  <p className="text-sm text-gray-500">
                    {city.state} · {city.count} estabelecimento{city.count !== 1 ? 's' : ''}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA para donos de comércio */}
      <section className="py-12 px-4 bg-gray-50 border-t">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Você tem um comércio?</h2>
          <p className="text-gray-600 mb-6">
            Cadastre seu estabelecimento gratuitamente e apareça nas buscas locais.
          </p>
          <Link
            href="/login"
            className="inline-block bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Cadastrar meu comércio
          </Link>
        </div>
      </section>
    </div>
  );
}
```

---

## Verificação ✅

Execute e confirme **todos** os itens antes de chamar TASK_10:

- [ ] `npm run dev` sem erros
- [ ] Home (`/`) carrega com hero, busca e seção de categorias
- [ ] Digitar "Ituv" na busca → sugere "Ituverava, SP" (se seedado)
- [ ] Digitar "São Paulo" → sugere São Paulo e cidades com nome parecido
- [ ] Clicar em resultado → redireciona para `/restaurantes/sp/[slug]`
- [ ] Clicar fora do dropdown → fecha a lista
- [ ] Estatísticas de comércios/cidades aparecem (se houver dados)
- [ ] Cidades em destaque aparecem (se houver comércios publicados)
- [ ] `/api/cities/search?q=sao` retorna JSON com cidades

---

## Arquivos criados nesta task
- `src/app/api/cities/search/route.ts`
- `src/components/public/city-search.tsx`
- `src/app/page.tsx`
