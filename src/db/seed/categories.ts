import { db } from '../index';
import { categories } from '../schema';
import { createId } from '@paralleldrive/cuid2';

const CATEGORIES = [
  { slug: 'pizzaria',       name: 'Pizzaria' },
  { slug: 'lanchonete',     name: 'Lanchonete' },
  { slug: 'restaurante',    name: 'Restaurante' },
  { slug: 'churrascaria',   name: 'Churrascaria' },
  { slug: 'padaria',        name: 'Padaria' },
  { slug: 'sorveteria',     name: 'Sorveteria' },
  { slug: 'bar',            name: 'Bar' },
  { slug: 'japones',        name: 'Japonês' },
  { slug: 'hamburguer',     name: 'Hambúrguer' },
  { slug: 'cafe',           name: 'Café' },
  { slug: 'doces-e-bolos',  name: 'Doces e Bolos' },
  { slug: 'marmitaria',     name: 'Marmitaria' },
];

async function seed() {
  console.log('Seeding categories...');
  for (const cat of CATEGORIES) {
    await db
      .insert(categories)
      .values({ id: createId(), ...cat })
      .onConflictDoNothing();
  }
  console.log(`✅ ${CATEGORIES.length} categories seeded.`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
