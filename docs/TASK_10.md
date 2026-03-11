# TASK 10 — SEO Final: Sitemap e robots.txt

## Pré-requisito: verificar TASK 9 concluída

```bash
test -f src/app/page.tsx && echo "OK: home page" || echo "FALHOU — rode TASK 9"
test -f src/components/public/city-search.tsx && echo "OK: city-search" || echo "FALHOU — rode TASK 9"
test -f src/app/api/cities/search/route.ts && echo "OK: cities API" || echo "FALHOU — rode TASK 9"
```

Se qualquer check falhar, **pare e execute TASK 9 primeiro**.

Antes de continuar, verifique também que o projeto faz build sem erros críticos:
```bash
npm run build 2>&1 | tail -20
```

---

## Objetivo
Sitemap dinâmico cobrindo todas as URLs públicas, `robots.txt` correto, metadados canônicos e validação final de SEO (Lighthouse).

---

## Passos

### 1. Criar `src/app/sitemap.ts`

```ts
import { MetadataRoute } from 'next';
import { db } from '@/db';
import { commerces, cities, categories, commerceCategories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://example.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Home
  entries.push({
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1.0,
  });

  // Páginas de comércio individuais
  const publishedCommerces = await db.query.commerces.findMany({
    where: eq(commerces.published, true),
    columns: { slug: true, updatedAt: true },
  });

  for (const c of publishedCommerces) {
    entries.push({
      url: `${BASE_URL}/comercio/${c.slug}`,
      lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  // Páginas de listagem por cidade
  const publishedWithCity = await db.query.commerces.findMany({
    where: and(eq(commerces.published, true)),
    columns: { cityId: true },
    with: { city: true },
  });

  const citySet = new Map<string, { slug: string; state: string }>();
  for (const c of publishedWithCity) {
    if (c.city && !citySet.has(c.city.id)) {
      citySet.set(c.city.id, { slug: c.city.slug, state: c.city.state });
    }
  }

  for (const [, city] of citySet) {
    entries.push({
      url: `${BASE_URL}/restaurantes/${city.state.toLowerCase()}/${city.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    });
  }

  // Páginas de listagem por cidade × categoria
  const links = await db.query.commerceCategories.findMany({
    with: {
      commerce: { with: { city: true } },
      category: true,
    },
  });

  const comboSet = new Set<string>();
  for (const link of links) {
    if (!link.commerce?.published || !link.commerce?.city) continue;
    const city = link.commerce.city;
    const cat = link.category;
    const key = `${city.state.toLowerCase()}/${city.slug}/${cat.slug}`;
    if (!comboSet.has(key)) {
      comboSet.add(key);
      entries.push({
        url: `${BASE_URL}/restaurantes/${key}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  }

  return entries;
}
```

### 2. Criar `src/app/robots.ts`

```ts
import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://example.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

### 3. Adicionar metadados globais em `src/app/layout.tsx`

Edite o `layout.tsx` existente para adicionar metadados base:

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://example.com';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Cardápio Digital — Comércios na sua cidade',
    template: '%s | Cardápio Digital',
  },
  description: 'Encontre restaurantes, padarias e comércios locais. Veja cardápios, horários e formas de atendimento.',
  openGraph: {
    siteName: 'Cardápio Digital',
    locale: 'pt_BR',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

### 4. Adicionar metadado `canonical` nas páginas de comércio

Edite `src/app/comercio/[slug]/page.tsx` para incluir `alternates.canonical`:

```ts
// Dentro de generateMetadata:
return {
  // ... metadados existentes ...
  alternates: {
    canonical: `/comercio/${slug}`,
  },
};
```

### 5. Adicionar header de navegação global nas páginas públicas

Crie um layout para as rotas públicas. Crie `src/app/(public)/layout.tsx`:

> **Atenção**: As rotas de listagem estão em `src/app/restaurantes/` e `src/app/comercio/`. Para aplicar um layout compartilhado, mova-as para dentro de um grupo `(public)` ou crie um layout em `src/app/layout.tsx`. A opção mais simples é criar um componente de header e importar na `src/app/layout.tsx`.

Crie `src/components/public/site-header.tsx`:

```tsx
import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b bg-white sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">
          🍽 Cardápio Digital
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
            Área do comércio
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

Edite `src/app/layout.tsx` para incluir o `SiteHeader`:

```tsx
import { SiteHeader } from '@/components/public/site-header';

// ... dentro do body:
<body className="...">
  <SiteHeader />
  {children}
</body>
```

> **Nota**: O `DashboardLayout` já tem seu próprio header, então o `SiteHeader` global ficará apenas nas páginas públicas. Para evitar que apareça duas vezes no dashboard, remova-o do `layout.tsx` raiz e adicione-o apenas nas páginas públicas que precisam — ou use um grupo de rotas `(public)` com seu próprio layout.

A solução mais limpa é criar `src/app/(public)/layout.tsx`:

```tsx
import { SiteHeader } from '@/components/public/site-header';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
```

E mover as rotas públicas para dentro de `(public)/`:
- `src/app/page.tsx` → `src/app/(public)/page.tsx`
- `src/app/comercio/` → `src/app/(public)/comercio/`
- `src/app/restaurantes/` → `src/app/(public)/restaurantes/`

### 6. Validação de build final

```bash
npm run build
```

Corrija todos os erros de TypeScript e de build antes de prosseguir.

Erros comuns e soluções:
- **`useSearchParams` without Suspense**: envolva o componente com `<Suspense>` no page.tsx pai
- **Tipos incompatíveis nas relações Drizzle**: verifique os `with:` e ajuste os tipos
- **`window is not defined`**: certifique que componentes com `window` usam `'use client'` ou dynamic import
- **`NEXT_PUBLIC_*` no servidor**: use `process.env` diretamente, não via variável interpolada

### 7. Checklist de SEO final

Após o build, rode um servidor de produção:

```bash
npm run start
```

Abra o Chrome DevTools → Lighthouse e rode uma auditoria de SEO em:
- `/` (home)
- `/restaurantes/[estado]/[cidade]`
- `/restaurantes/[estado]/[cidade]/[categoria]`
- `/comercio/[slug]`

**Metas**:
- Lighthouse SEO: ≥ 90
- Performance: ≥ 80 (Next.js Image + SSG ajudam muito)

---

## Verificação ✅ — Final de projeto

- [ ] `npm run build` sem erros
- [ ] `/sitemap.xml` lista todas as URLs publicadas (acessar em dev: `/sitemap.xml`)
- [ ] `/robots.txt` bloqueia `/dashboard/` e `/api/`
- [ ] `<html lang="pt-BR">` no documento
- [ ] `<title>` correto em todas as páginas
- [ ] `<meta name="description">` presente em todas as páginas públicas
- [ ] JSON-LD presente nas páginas de comércio e listagem de categoria
- [ ] Imagens com `alt` text
- [ ] Links com texto descritivo (não "clique aqui")
- [ ] Lighthouse SEO ≥ 90 nas páginas públicas
- [ ] Header de navegação aparece nas páginas públicas
- [ ] Header NÃO aparece duas vezes no dashboard

---

## Resumo do projeto completo

Após TASK_10 concluída, o projeto tem:

| Rota | Tipo | Descrição |
|---|---|---|
| `/` | SSG (24h) | Home com busca |
| `/login` | Dinâmica | Magic link auth |
| `/dashboard` | Protegida | Overview + completude |
| `/dashboard/perfil` | Protegida | Editar comércio + logo |
| `/dashboard/cardapio` | Protegida | Editor Markdown |
| `/dashboard/horarios` | Protegida | Grid de horários |
| `/comercio/[slug]` | SSG + ISR | Página pública do comércio |
| `/restaurantes/[estado]/[cidade]` | SSG + ISR | Listagem por cidade |
| `/restaurantes/[estado]/[cidade]/[categoria]` | SSG + ISR | Listagem por cidade × categoria |
| `/sitemap.xml` | Dinâmica | Sitemap completo |
| `/robots.txt` | Estática | Regras de indexação |

---

## Arquivos criados nesta task
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/app/layout.tsx` (atualizado)
- `src/components/public/site-header.tsx`
- `src/app/(public)/layout.tsx` (opcional, organização)
