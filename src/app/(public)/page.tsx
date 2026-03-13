import { db } from '@/db';
import { commerces } from '@/db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { CitySearch } from '@/components/public/city-search';
import Link from 'next/link';
import type { Metadata } from 'next';

export const revalidate = 86400; // revalidar a cada 24h

export const metadata: Metadata = {
  title: 'Comer na Cidade — Encontre comércios na sua cidade',
  description:
    'Descubra restaurantes, padarias, lanchonetes e mais na sua cidade. Veja cardápios completos, horários e formas de atendimento.',
};

async function getStats() {
  try {
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
  } catch {
    return { commerces: 0, cities: 0 };
  }
}

async function getFeaturedCities() {
  try {
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
  } catch {
    return [];
  }
}

async function getCategories() {
  try {
    return await db.query.categories.findMany({ orderBy: (c, { asc }) => asc(c.name) });
  } catch {
    return [];
  }
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
