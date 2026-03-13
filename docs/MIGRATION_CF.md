# Migração: Vercel + Turso → Cloudflare Pages + D1

## Visão Geral

Este guia cobre a migração completa do projeto de Vercel (Node.js runtime) com Turso (libsql) para Cloudflare Pages com D1 (SQLite nativo no Workers runtime).

A mudança arquitetural central é: **o cliente de banco de dados deixa de ser um singleton global e passa a ser criado por request**, pois o binding D1 só existe no contexto de cada requisição Workers.

---

## 1. Dependências

### Remover
```bash
npm uninstall @libsql/client
```

### Adicionar
```bash
npm install -D wrangler @opennextjs/cloudflare
```

### Manter (sem alterações)
- `drizzle-orm`, `drizzle-kit`
- `next-auth` (Auth.js v5)
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- Todos os pacotes shadcn/ui, Tailwind, React, Next.js

---

## 2. wrangler.toml (novo arquivo na raiz)

Criar `wrangler.toml`:

```toml
name = "comernacidade"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

pages_build_output_dir = ".vercel/output/static"

[[d1_databases]]
binding = "DB"
database_name = "comernacidade-prod"
database_id = "<ID_DO_D1_AQUI>"  # obtido com: wrangler d1 create comernacidade-prod

[vars]
NEXT_PUBLIC_APP_URL = "https://comernacidade.com.br"
NEXT_PUBLIC_R2_PUBLIC_URL = "https://pub-<hash>.r2.dev"

# Secrets (configurar via dashboard ou wrangler secret put):
# AUTH_SECRET
# AUTH_RESEND_KEY
# R2_ACCOUNT_ID
# R2_ACCESS_KEY_ID
# R2_SECRET_ACCESS_KEY
# R2_BUCKET
```

Para criar o banco D1:
```bash
wrangler d1 create comernacidade-prod
# Copiar o database_id retornado para wrangler.toml
```

Para ambiente local de dev, adicionar `wrangler.toml` seção de preview:
```toml
[[env.preview.d1_databases]]
binding = "DB"
database_name = "comernacidade-preview"
database_id = "<ID_DO_D1_PREVIEW>"
```

---

## 3. drizzle.config.ts

### Antes
```ts
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
```

### Depois
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
```

As variáveis `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` e `CLOUDFLARE_D1_TOKEN` são usadas apenas localmente para rodar `drizzle-kit push` ou `drizzle-kit generate`. O token D1 HTTP é gerado no Cloudflare Dashboard → Workers & Pages → D1 → seu banco → API Tokens.

Alternativa para desenvolvimento local com SQLite em arquivo:
```ts
// drizzle.config.local.ts
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite' },
});
```

---

## 4. src/db/index.ts — Mudança Arquitetural Central

### Antes (singleton global com libsql)
```ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

### Depois (factory por request com D1 binding)
```ts
import { drizzle } from 'drizzle-orm/d1';
import { getRequestContext } from '@opennextjs/cloudflare';
import * as schema from './schema';

export type DrizzleD1 = ReturnType<typeof drizzle<typeof schema>>;

export function getDb(): DrizzleD1 {
  const { env } = getRequestContext();
  return drizzle(env.DB, { schema });
}
```

Adicionar tipagem do binding em `src/types/cloudflare-env.d.ts`:
```ts
interface CloudflareEnv {
  DB: D1Database;
  AUTH_SECRET: string;
  AUTH_RESEND_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_R2_PUBLIC_URL: string;
}
```

---

## 5. src/auth.ts

O `DrizzleAdapter` precisa de uma instância `db` por request. Há duas abordagens:

### Abordagem A — auth como factory function (recomendada)
```ts
import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/db';
import * as schema from '@/db/schema';

export function createAuth() {
  const db = getDb();
  return NextAuth({
    adapter: DrizzleAdapter(db, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    }),
    providers: [
      Resend({
        apiKey: process.env.AUTH_RESEND_KEY,
        from: 'noreply@comernacidade.com.br',
      }),
    ],
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  });
}

// Para uso em route handlers e middleware:
export const { handlers, auth, signIn, signOut } = createAuth();
```

### Abordagem B — passar db explicitamente nos route handlers
Manter `NextAuth` estático mas passar `getDb()` diretamente nos `api/auth` route handlers. Mais verbose, menos recomendada.

---

## 6. Consumidores de `db` → `getDb()`

Substituir todas as ocorrências de `import { db } from '@/db'` + uso direto de `db` por `getDb()` chamado dentro do handler. Arquivos afetados:

### src/app/api/commerce/route.ts
```ts
// Antes
import { db } from '@/db';
// ...
const commerce = await db.query.commerces.findFirst(...);

// Depois
import { getDb } from '@/db';
// ...
const db = getDb();
const commerce = await db.query.commerces.findFirst(...);
```

### src/app/api/commerce/hours/route.ts
```ts
import { getDb } from '@/db';
// No início de cada handler:
const db = getDb();
```

### src/app/api/menu/route.ts
```ts
import { getDb } from '@/db';
const db = getDb();
```

### src/app/api/cities/search/route.ts
```ts
import { getDb } from '@/db';
const db = getDb();
```

### src/app/api/upload/logo/route.ts e src/app/api/upload/menu-image/route.ts
Esses routes usam R2 via AWS SDK — não usam `db` diretamente, mas verificar se buscam o commerce para autorização. Se sim, aplicar `getDb()`.

### src/app/dashboard/page.tsx e sub-páginas
Server Components podem chamar `getDb()` diretamente:
```ts
import { getDb } from '@/db';

export default async function DashboardPage() {
  const db = getDb();
  const commerce = await db.query.commerces.findFirst(...);
  // ...
}
```

### src/app/(public)/page.tsx e sub-páginas
Mesma abordagem — Server Components chamam `getDb()` dentro do componente.

### src/lib/queries.ts
Converter funções para receber `db` como parâmetro:
```ts
// Antes
import { db } from '@/db';
export async function getCommerceBySlug(slug: string) {
  return db.query.commerces.findFirst({ where: eq(commerces.slug, slug) });
}

// Depois
import type { DrizzleD1 } from '@/db';
export async function getCommerceBySlug(db: DrizzleD1, slug: string) {
  return db.query.commerces.findFirst({ where: eq(commerces.slug, slug) });
}
// Chamadores passam getDb() como primeiro argumento
```

### src/app/sitemap.ts
Ver seção 10 — limitações de `generateStaticParams` / sitemap em build time.

---

## 7. Seed Scripts → SQL Files

Seeds Node.js (`src/db/seed/cities.ts`, `src/db/seed/categories.ts`) não rodam em Workers. Exportar como SQL:

### Gerar SQL de categorias
```bash
# Executar localmente e redirecionar para arquivo SQL
npx tsx src/db/seed/export-categories.sql.ts > seed-categories.sql
```

Criar `src/db/seed/export-categories.sql.ts`:
```ts
import { categories } from '../schema';
// Gera INSERT statements
const rows = [/* mesmos dados do seed */];
for (const row of rows) {
  console.log(`INSERT OR IGNORE INTO categories (id, name, slug, icon) VALUES ('${row.id}', '${row.name}', '${row.slug}', '${row.icon}');`);
}
```

### Aplicar seeds no D1 remoto
```bash
wrangler d1 execute DB --file=seed-categories.sql --remote
wrangler d1 execute DB --file=seed-cities.sql --remote
```

### Aplicar seeds no D1 local (dev)
```bash
wrangler d1 execute DB --file=seed-categories.sql --local
wrangler d1 execute DB --file=seed-cities.sql --local
```

---

## 8. Variáveis de Ambiente

### Remover do .env.local
```
DATABASE_URL=
DATABASE_AUTH_TOKEN=
```

### Adicionar ao .env.local (apenas para drizzle-kit local)
```
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=
```

### Manter no .env.local
```
AUTH_SECRET=
AUTH_RESEND_KEY=
NEXT_PUBLIC_APP_URL=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
NEXT_PUBLIC_R2_PUBLIC_URL=
```

### Secrets em produção (Cloudflare Dashboard ou CLI)
```bash
wrangler secret put AUTH_SECRET
wrangler secret put AUTH_RESEND_KEY
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_BUCKET
```

> **Nota:** Bindings D1 e variáveis não-secretas são configurados em `wrangler.toml`, não como secrets.

---

## 9. Scripts package.json

### Adicionar
```json
{
  "scripts": {
    "deploy": "opennextjs-cloudflare build && wrangler pages deploy",
    "dev:cf": "wrangler pages dev",
    "db:migrate:cf": "wrangler d1 migrations apply DB --remote",
    "db:migrate:cf:local": "wrangler d1 migrations apply DB --local",
    "db:seed:cf": "wrangler d1 execute DB --file=seed-categories.sql --remote && wrangler d1 execute DB --file=seed-cities.sql --remote"
  }
}
```

### Remover ou adaptar
```json
{
  "scripts": {
    "db:migrate": "drizzle-kit migrate"  // agora aponta para D1 via d1-http driver
  }
}
```

---

## 10. generateStaticParams e Sitemap — Limitação

### Problema
`generateStaticParams` e `sitemap.ts` rodam em **build time no Node.js**, mas o binding D1 só existe no runtime Workers. Não há como acessar `getDb()` nesse contexto.

### Opção A — Dynamic rendering (mais simples, recomendada)
Adicionar em todas as páginas que usam `generateStaticParams`:

```ts
// src/app/(public)/comercio/[slug]/page.tsx
export const dynamic = 'force-dynamic';
// Remover generateStaticParams completamente
```

```ts
// src/app/sitemap.ts
export const dynamic = 'force-dynamic';
```

Isso faz as páginas serem renderizadas on-demand no Workers runtime, onde `getDb()` funciona normalmente.

### Opção B — D1 HTTP API em build time
Acessar o D1 via REST API direta da Cloudflare durante o build (Node.js):

```ts
// src/lib/db-build.ts — apenas para build time
import { drizzle } from 'drizzle-orm/d1-http'; // se disponível
// ou usar fetch direto para Cloudflare D1 HTTP API
```

Esta opção é mais complexa e frágil — **prefira a Opção A**.

### Opção C — ISR / On-demand revalidation
Configurar revalidação por tempo ou tag em vez de geração estática. Compatível com `force-dynamic` no Workers.

---

## Fluxo de Deploy Completo

```bash
# 1. Criar banco D1 (uma vez)
wrangler d1 create comernacidade-prod

# 2. Atualizar wrangler.toml com o database_id retornado

# 3. Aplicar migrations
wrangler d1 migrations apply DB --remote

# 4. Popular seeds
wrangler d1 execute DB --file=seed-categories.sql --remote
wrangler d1 execute DB --file=seed-cities.sql --remote

# 5. Build e deploy
npm run deploy
```

---

## Verificação Final

Após as mudanças:

- [ ] `npm run build` sem erros
- [ ] `wrangler pages dev` sobe o servidor local com D1 local
- [ ] Login via magic link funciona (Auth.js com DrizzleAdapter dinâmico)
- [ ] Dashboard carrega dados do D1
- [ ] Upload de imagens para R2 funciona
- [ ] Páginas públicas (`/comercio/[slug]`, `/restaurantes/...`) renderizam
- [ ] `npm run deploy` publica em Cloudflare Pages sem erros
