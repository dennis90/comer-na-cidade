# Migração: Turso/libsql → Supabase (PostgreSQL)

Este guia cobre todas as mudanças necessárias para migrar o banco de dados de Turso/libsql para Supabase (PostgreSQL).

> **Arquivos que NÃO mudam:** `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`, todas as rotas em `src/app/api/`, todas as pages do dashboard e catálogo público, scripts de seed, `src/lib/slugify.ts`, `src/lib/utils.ts`. Cloudflare R2 permanece para imagens.

---

## 1. Pré-requisitos

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. Aguarde o provisionamento (geralmente 1–2 minutos).
3. Em **Project Settings → Database**, copie:
   - **Connection string (Transaction mode)** — porta `6543`, use como `DATABASE_POOL_URL`
   - **Connection string (Session mode)** — porta `5432`, use como `DATABASE_URL`

   O formato é:
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```

---

## 2. Pacotes

Remova o cliente libsql e instale o driver postgres.js:

```bash
npm uninstall @libsql/client
npm install postgres
```

> `drizzle-orm` e `drizzle-kit` permanecem — apenas o dialeto muda.

---

## 3. Variáveis de ambiente

No `.env.local`, remova `DATABASE_AUTH_TOKEN` e adicione `DATABASE_POOL_URL`:

```diff
- DATABASE_URL="libsql://seu-db.turso.io"
- DATABASE_AUTH_TOKEN="eyJ..."
+ DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
+ DATABASE_POOL_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

Atualize também o `.env.example`:

```diff
- DATABASE_URL=libsql://...
- DATABASE_AUTH_TOKEN=...
+ DATABASE_URL=postgresql://...    # Session mode (porta 5432) — migrações
+ DATABASE_POOL_URL=postgresql://... # Transaction mode (porta 6543) — runtime
```

---

## 4. `drizzle.config.ts`

```ts
import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '.env.local' });

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

**Mudanças:**
- `dialect: 'turso'` → `dialect: 'postgresql'`
- Remove `authToken` de `dbCredentials`

---

## 5. `src/db/index.ts`

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL!;

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export type DB = typeof db;
```

**Mudanças:**
- `drizzle-orm/libsql` → `drizzle-orm/postgres-js`
- `@libsql/client` → `postgres`
- Prefere `DATABASE_POOL_URL` (transaction pooler, porta 6543) no runtime
- `prepare: false` é obrigatório com o Supabase transaction pooler (não suporta prepared statements)

---

## 6. `src/db/schema.ts`

### 6.1 Imports

```diff
- import {
-   text,
-   integer,
-   real,
-   sqliteTable,
-   primaryKey,
-   index,
- } from 'drizzle-orm/sqlite-core';
+ import {
+   text,
+   integer,
+   boolean,
+   doublePrecision,
+   timestamp,
+   pgTable,
+   primaryKey,
+   index,
+ } from 'drizzle-orm/pg-core';
```

### 6.2 Renomear `sqliteTable` → `pgTable`

Substitua todas as ocorrências de `sqliteTable` por `pgTable`.

### 6.3 Tipos de coluna — mapeamento completo

| SQLite (antes) | PostgreSQL (depois) |
|---|---|
| `integer({ mode: 'boolean' })` | `boolean()` |
| `integer({ mode: 'timestamp' })` | `timestamp({ mode: 'date' })` |
| `integer({ mode: 'timestamp_ms' })` | `timestamp({ mode: 'date' })` |
| `real(...)` | `doublePrecision(...)` |
| `sql\`(unixepoch())\`` | `sql\`now()\`` |

### 6.4 Schema completo pós-migração

```ts
import { sql, relations } from 'drizzle-orm';
import {
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  pgTable,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

// ─── Auth.js tables ────────────────────────────────────────────────────────────

export const users = pgTable('user', {
  id: text('id').notNull().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`now()`),
});

export const accounts = pgTable(
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

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─── Domain tables ──────────────────────────────────────────────────────────────

export const cities = pgTable('city', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  state: text('state').notNull(),
  ibgeCode: text('ibge_code').notNull().unique(),
  population: integer('population'),
}, (t) => ({
  stateIdx: index('city_state_idx').on(t.state),
}));

export const categories = pgTable('category', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull().unique(),
});

export const commerces = pgTable('commerce', {
  id: text('id').notNull().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address'),
  cityId: text('city_id').references(() => cities.id),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  instagram: text('instagram'),
  logoUrl: text('logo_url'),
  published: boolean('published').notNull().default(false),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'date' }).default(sql`now()`),
  updatedAt: timestamp('updated_at', { mode: 'date' }).default(sql`now()`),
}, (t) => ({
  ownerIdx: index('commerce_owner_idx').on(t.ownerId),
  cityIdx: index('commerce_city_idx').on(t.cityId),
  publishedIdx: index('commerce_published_idx').on(t.published),
}));

export const commerceCategories = pgTable(
  'commerce_category',
  {
    commerceId: text('commerce_id').notNull().references(() => commerces.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.commerceId, t.categoryId] }),
  })
);

export const commerceModalities = pgTable(
  'commerce_modality',
  {
    commerceId: text('commerce_id').notNull().references(() => commerces.id, { onDelete: 'cascade' }),
    modality: text('modality', { enum: ['delivery', 'dine_in', 'takeout'] }).notNull(),
    deliveryRadiusKm: doublePrecision('delivery_radius_km'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.commerceId, t.modality] }),
  })
);

export const operatingHours = pgTable('operating_hours', {
  id: text('id').notNull().primaryKey(),
  commerceId: text('commerce_id').notNull().references(() => commerces.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  opensAt: text('opens_at').notNull(),
  closesAt: text('closes_at').notNull(),
}, (t) => ({
  commerceIdx: index('hours_commerce_idx').on(t.commerceId),
}));

export const menus = pgTable('menu', {
  id: text('id').notNull().primaryKey(),
  commerceId: text('commerce_id').notNull().unique().references(() => commerces.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  updatedAt: timestamp('updated_at', { mode: 'date' }).default(sql`now()`),
});

// ─── Types ──────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type City = typeof cities.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Commerce = typeof commerces.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type OperatingHours = typeof operatingHours.$inferSelect;

// ─── Relations ──────────────────────────────────────────────────────────────────

export const commercesRelations = relations(commerces, ({ one, many }) => ({
  owner: one(users, { fields: [commerces.ownerId], references: [users.id] }),
  city: one(cities, { fields: [commerces.cityId], references: [cities.id] }),
  commerceCategories: many(commerceCategories),
  commerceModalities: many(commerceModalities),
  operatingHours: many(operatingHours),
  menu: one(menus, { fields: [commerces.id], references: [menus.commerceId] }),
}));

export const commerceCategoriesRelations = relations(commerceCategories, ({ one }) => ({
  commerce: one(commerces, { fields: [commerceCategories.commerceId], references: [commerces.id] }),
  category: one(categories, { fields: [commerceCategories.categoryId], references: [categories.id] }),
}));

export const commerceModalitiesRelations = relations(commerceModalities, ({ one }) => ({
  commerce: one(commerces, { fields: [commerceModalities.commerceId], references: [commerces.id] }),
}));

export const operatingHoursRelations = relations(operatingHours, ({ one }) => ({
  commerce: one(commerces, { fields: [operatingHours.commerceId], references: [commerces.id] }),
}));

export const menusRelations = relations(menus, ({ one }) => ({
  commerce: one(commerces, { fields: [menus.commerceId], references: [commerces.id] }),
}));

export const citiesRelations = relations(cities, ({ many }) => ({
  commerces: many(commerces),
}));
```

---

## 7. Regenerar migrações

As migrações SQLite existentes em `drizzle/` são incompatíveis com PostgreSQL. Delete-as e regenere:

```bash
# Apaga todas as migrações antigas
rm -rf drizzle/

# Gera novas migrações PostgreSQL a partir do schema
npm run db:generate

# Aplica as migrações no Supabase
npm run db:migrate
```

> **Atenção:** `db:migrate` usa `DATABASE_URL` (session mode, porta 5432). O Supabase transaction pooler (porta 6543) não suporta o protocolo de migração do Drizzle.

---

## 8. Seeds

Após a migração bem-sucedida, popule as tabelas de referência:

```bash
npm run db:seed:categories   # 12 categorias de comida
npm run db:seed:cities        # ~5570 municípios brasileiros (IBGE)
```

---

## 9. Checklist de verificação

- [ ] Projeto Supabase criado e connection strings copiadas
- [ ] `npm uninstall @libsql/client && npm install postgres` executado
- [ ] `.env.local` atualizado (remove `DATABASE_AUTH_TOKEN`, adiciona `DATABASE_POOL_URL`)
- [ ] `drizzle.config.ts` atualizado (`dialect: 'postgresql'`, sem `authToken`)
- [ ] `src/db/index.ts` atualizado (postgres.js, `prepare: false`)
- [ ] `src/db/schema.ts` atualizado (pg-core, tipos corretos)
- [ ] `drizzle/` deletada e `npm run db:generate` executado
- [ ] `npm run db:migrate` executado com sucesso
- [ ] Seeds executados
- [ ] `npm run build` sem erros TypeScript
- [ ] `grep -r "libsql" src/` retorna vazio

---

## 10. Notas Supabase

### Row Level Security (RLS)
O Supabase habilita RLS por padrão em novas tabelas criadas via interface. Como o Drizzle gerencia o schema via migrações SQL diretas (não via interface), as tabelas criadas **não terão RLS habilitado automaticamente**. Isso é o comportamento desejado para esta aplicação — a autorização é feita na camada de API.

### Connection Pooling
- Use `DATABASE_POOL_URL` (porta 6543, transaction mode) no runtime da aplicação
- Use `DATABASE_URL` (porta 5432, session mode) apenas para migrações (`db:generate`, `db:migrate`)
- O transaction pooler não suporta prepared statements — daí o `prepare: false`

### Free Tier — limites relevantes
| Recurso | Limite |
|---|---|
| Banco de dados | 500 MB |
| Bandwidth | 5 GB/mês |
| Conexões diretas | 60 |
| Conexões via pooler | 200 |

### Pausa por inatividade
Projetos no free tier são pausados após **7 dias sem atividade**. O primeiro request após a pausa pode levar alguns segundos para "acordar" o banco. Para produção, considere o plano Pro ou use um cron job leve para manter o projeto ativo.
