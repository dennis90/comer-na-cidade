# TASK 2 — Schema do Banco e Seed de Cidades

## Pré-requisito: verificar TASK 1 concluída

Antes de continuar, confirme que:

```bash
# 1. package.json existe com scripts db:*
grep -q "db:generate" package.json && echo "OK" || echo "FALHOU — rode TASK 1"

# 2. drizzle.config.ts existe
test -f drizzle.config.ts && echo "OK" || echo "FALHOU — rode TASK 1"

# 3. src/db/ existe
test -d src/db && echo "OK" || echo "FALHOU — rode TASK 1"

# 4. dependências instaladas
test -d node_modules/drizzle-orm && echo "OK" || echo "FALHOU — rode TASK 1"
test -d node_modules/@libsql && echo "OK" || echo "FALHOU — rode TASK 1"
```

Se qualquer check falhar, **pare e execute TASK 1 primeiro**.

---

## Objetivo
Banco de dados estruturado com todas as tabelas, ~5.570 cidades brasileiras seedadas e categorias iniciais.

---

## Passos

### 1. Criar `src/db/schema.ts`

```ts
import { sql } from 'drizzle-orm';
import {
  text,
  integer,
  real,
  sqliteTable,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';

// ─── Auth.js tables ───────────────────────────────────────────────────────────

export const users = sqliteTable('user', {
  id: text('id').notNull().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const accounts = sqliteTable(
  'account',
  {
    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─── Domain tables ─────────────────────────────────────────────────────────────

export const cities = sqliteTable('city', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  state: text('state').notNull(),        // "SP", "MG", etc.
  ibgeCode: text('ibge_code').notNull().unique(),
  population: integer('population'),
}, (t) => ({
  stateIdx: index('city_state_idx').on(t.state),
}));

export const categories = sqliteTable('category', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull().unique(),
});

export const commerces = sqliteTable('commerce', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address'),
  cityId: text('city_id').references(() => cities.id),
  lat: real('lat'),
  lng: real('lng'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  instagram: text('instagram'),
  logoUrl: text('logo_url'),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  ownerIdx: index('commerce_owner_idx').on(t.ownerId),
  cityIdx: index('commerce_city_idx').on(t.cityId),
  publishedIdx: index('commerce_published_idx').on(t.published),
}));

export const commerceCategories = sqliteTable(
  'commerce_category',
  {
    commerceId: text('commerce_id').notNull().references(() => commerces.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.commerceId, t.categoryId] }),
  })
);

export const commerceModalities = sqliteTable(
  'commerce_modality',
  {
    commerceId: text('commerce_id').notNull().references(() => commerces.id, { onDelete: 'cascade' }),
    modality: text('modality', { enum: ['delivery', 'dine_in', 'takeout'] }).notNull(),
    deliveryRadiusKm: real('delivery_radius_km'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.commerceId, t.modality] }),
  })
);

export const operatingHours = sqliteTable('operating_hours', {
  id: text('id').notNull().primaryKey(),
  commerceId: text('commerce_id').notNull().references(() => commerces.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0=dom .. 6=sab
  opensAt: text('opens_at').notNull(),   // "HH:MM"
  closesAt: text('closes_at').notNull(), // "HH:MM"
}, (t) => ({
  commerceIdx: index('hours_commerce_idx').on(t.commerceId),
}));

export const menus = sqliteTable('menu', {
  id: text('id').notNull().primaryKey(),
  commerceId: text('commerce_id').notNull().unique().references(() => commerces.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type City = typeof cities.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Commerce = typeof commerces.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type OperatingHours = typeof operatingHours.$inferSelect;
```

### 2. Criar `src/db/index.ts`

```ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
```

### 3. Criar `src/lib/slugify.ts`

```ts
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
```

### 4. Criar seed de categorias `src/db/seed/categories.ts`

```ts
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
```

### 5. Criar seed de cidades `src/db/seed/cities.ts`

O seed lê o CSV do IBGE. Baixe o arquivo CSV em:
https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv

O CSV tem colunas: `codigo_ibge,nome,latitude,longitude,capital,codigo_uf,siafi_id,ddd,fuso_horario`

Mapeamento de código UF para sigla de estado — inclua a tabela completa no script:

```ts
import { db } from '../index';
import { cities } from '../schema';
import { createId } from '@paralleldrive/cuid2';
import { slugify } from '../../lib/slugify';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mapa: codigo_uf -> sigla
const UF_MAP: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
  '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
  '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
  '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
  '52': 'GO', '53': 'DF',
};

async function seed() {
  // Baixe o CSV e salve em src/db/seed/municipios.csv antes de rodar
  const csvPath = join(process.cwd(), 'src/db/seed/municipios.csv');
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.trim().split('\n');
  const header = lines[0].split(',');

  const ibgeIdx    = header.indexOf('codigo_ibge');
  const nameIdx    = header.indexOf('nome');
  const ufCodeIdx  = header.indexOf('codigo_uf');

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',');
    const ibgeCode = cols[ibgeIdx]?.trim();
    const name     = cols[nameIdx]?.trim().replace(/^"(.*)"$/, '$1');
    const ufCode   = cols[ufCodeIdx]?.trim();
    const state    = UF_MAP[ufCode] ?? ufCode;
    return { ibgeCode, name, state };
  }).filter((r) => r.ibgeCode && r.name && r.state);

  console.log(`Seeding ${rows.length} cities...`);

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) => ({
      id: createId(),
      slug: slugify(r.name),
      name: r.name,
      state: r.state,
      ibgeCode: r.ibgeCode,
      population: null,
    }));
    await db.insert(cities).values(batch).onConflictDoNothing();
    process.stdout.write(`\r${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log('\n✅ Cities seeded.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
```

> **Importante**: antes de rodar o seed, baixe o CSV:
> ```bash
> curl -o src/db/seed/municipios.csv \
>   "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv"
> ```

### 6. Gerar e rodar as migrations

```bash
# Gerar SQL de migração
npm run db:generate

# Aplicar no banco (precisa das vars de ambiente no .env.local)
npm run db:migrate
```

### 7. Rodar os seeds

```bash
# Primeiro categorias
npm run db:seed:categories

# Depois baixar o CSV e rodar cidades
curl -o src/db/seed/municipios.csv \
  "https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv"

npm run db:seed:cities
```

---

## Verificação ✅

Execute e confirme que **todos** os itens passam antes de chamar TASK_3:

- [ ] `npm run db:generate` criou arquivos em `drizzle/` sem erros
- [ ] `npm run db:migrate` aplicou as migrations sem erros
- [ ] `npm run db:seed:categories` → "12 categories seeded."
- [ ] `npm run db:seed:cities` → "~5570 cities seeded."
- [ ] `npx drizzle-kit studio` → tabelas `city`, `category`, `commerce`, `menu`, `user` visíveis
- [ ] Consultar no studio: `SELECT COUNT(*) FROM city` retorna ~5570
- [ ] `src/db/schema.ts` exporta todos os tipos necessários

---

## Arquivos criados nesta task
- `src/db/schema.ts`
- `src/db/index.ts`
- `src/lib/slugify.ts`
- `src/db/seed/categories.ts`
- `src/db/seed/cities.ts`
- `src/db/seed/municipios.csv` (baixado via curl)
- `drizzle/` (gerado pelo drizzle-kit)
