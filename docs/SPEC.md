# Especificação de Implementação — Cardápio Digital por Região

## Visão Geral

Diretório regional de comércios alimentícios, similar a "Páginas Amarelas", onde cada estabelecimento possui sua própria página com cardápio gerenciado em Markdown. Clientes podem descobrir e filtrar restaurantes por localidade, categoria e modalidade de atendimento — sem processamento de pedidos ou pagamentos.

**Foco geográfico:** cidades pequenas e médias (até ~150k habitantes), mercado com cobertura fraca de plataformas como iFood e DoorDash e baixíssima concorrência nas SERPs locais. A estratégia de crescimento inicial é orgânica via SEO programático.

---

## Requisitos Funcionais

### Para o Cliente (visitante)
- Navegar por comércios por região/cidade
- Filtrar por:
  - Categoria (pizzaria, lanchonete, japonês, etc.)
  - Raio de localidade (distância em km a partir de um ponto)
  - Modalidade: entrega, consumo no local, retirada
- Ver a página individual de cada comércio com:
  - Informações do estabelecimento (nome, endereço, horários, contato)
  - Cardápio renderizado a partir de Markdown
  - Modalidades de atendimento disponíveis

### Para o Comércio (autenticado)
- Cadastrar e gerenciar o perfil do estabelecimento
- Escrever e editar o cardápio em Markdown (com preview em tempo real)
- Definir categorias, modalidades de atendimento e área de entrega
- Gerenciar horários de funcionamento
- Publicar/despublicar o estabelecimento

---

## Arquitetura e Stack

### Framework
**Next.js 15 (App Router)**

Justificativas:
- ISR (Incremental Static Regeneration): páginas de restaurantes são geradas estaticamente e revalidadas apenas quando o comércio atualiza o cardápio — ideal para cargas majoritariamente de leitura
- `generateStaticParams` para pré-gerar as páginas dos comércios no build
- Server Components reduzem JS no cliente para páginas públicas
- Route Handlers para a API do painel de gestão

Alternativa considerada — Remix: excelente para formulários e carregamento de dados, mas o ecossistema de cache/SSG do Next.js favorece melhor o perfil de leitura intensiva deste projeto.

### Banco de Dados
**SQLite via Turso (LibSQL)**

Justificativas:
- Read-heavy: SQLite performa muito bem com leituras concorrentes
- Turso oferece réplicas de borda (edge replicas) para latência baixa globalmente sem custo operacional adicional
- Sem necessidade de infra gerenciada (RDS, PlanetScale, etc.)
- Schema simples e sem joins complexos

ORM: **Drizzle ORM**
- Type-safe, sem runtime overhead
- Suporte nativo a LibSQL/Turso
- Migrations via `drizzle-kit`

### Autenticação
**Auth.js (NextAuth v5)**
- Providers: e-mail mágico (magic link) ou Google OAuth
- Sessão server-side via JWT ou database sessions

### Armazenamento de Imagens
**Cloudflare R2**

Justificativas:
- Sem custo de egress (diferencial crítico para um catálogo com imagens servidas frequentemente)
- S3-compatible API — mesma interface do `@aws-sdk/client-s3`, sem lock-in de SDK
- Integra bem com o ecossistema Cloudflare (CDN, Workers futuramente)
- Preço: ~$0,015/GB armazenado, egress gratuito

Uso no projeto:
- Logo do comércio (1 por comércio)
- Imagens de pratos inseridas no cardápio Markdown

### Outras dependências relevantes
| Função | Biblioteca |
|---|---|
| Renderização de Markdown | `next-mdx-remote` ou `marked` + `DOMPurify` |
| Editor Markdown | `@uiw/react-md-editor` |
| Upload de imagens | `@aws-sdk/client-s3` (compatível com R2) |
| Geolocalização / mapas | Nominatim (OpenStreetMap, gratuito) para geocoding |
| Cálculo de distância | Fórmula de Haversine (implementação própria, sem deps) |
| Validação | `zod` |
| UI | Tailwind CSS + shadcn/ui |

---

## Modelo de Dados (esquema inicial)

```
commerce
  id              TEXT PK (cuid)
  slug            TEXT UNIQUE          -- ex: "pizzaria-do-ze-sp"
  name            TEXT
  description     TEXT
  address         TEXT
  city            TEXT
  state           TEXT
  lat             REAL
  lng             REAL
  phone           TEXT
  instagram       TEXT
  whatsapp        TEXT
  published       INTEGER (0|1)
  owner_id        TEXT FK → user.id
  created_at      INTEGER (unix timestamp)
  updated_at      INTEGER

commerce_category
  commerce_id     TEXT FK → commerce.id
  category_id     TEXT FK → category.id

commerce_modality
  commerce_id     TEXT FK → commerce.id
  modality        TEXT (delivery | dine_in | takeout)
  delivery_radius_km  REAL (nullable)

operating_hours
  id              TEXT PK
  commerce_id     TEXT FK → commerce.id
  day_of_week     INTEGER (0=dom .. 6=sab)
  opens_at        TEXT (HH:MM)
  closes_at       TEXT (HH:MM)

menu
  id              TEXT PK
  commerce_id     TEXT FK → commerce.id  UNIQUE
  content         TEXT  -- Markdown bruto
  updated_at      INTEGER

category
  id              TEXT PK
  name            TEXT UNIQUE  -- ex: "Pizzaria", "Japonês"
  slug            TEXT UNIQUE

user
  id              TEXT PK
  email           TEXT UNIQUE
  name            TEXT
  created_at      INTEGER
```

---

## SEO Programático

### Estratégia central

O principal vetor de aquisição de visitantes é ranquear para queries de cauda longa como:

- "lanchonete em ituverava"
- "pizzaria em são joaquim da barra sp"
- "restaurante que entrega em aramina"

Essas queries têm volume baixo individualmente, mas a combinação de centenas de cidades × dezenas de categorias gera uma cauda longa com praticamente zero concorrência.

### Estrutura de URLs

```
/restaurantes/[estado]/[cidade-slug]/[categoria-slug]
  ex: /restaurantes/sp/ituverava/lanchonete
  ex: /restaurantes/sp/ituverava/pizzaria
  ex: /restaurantes/mg/passos/japones

/restaurantes/[estado]/[cidade-slug]
  ex: /restaurantes/sp/ituverava             -- todos os comércios da cidade

/comercio/[slug]
  ex: /comercio/lanchonete-da-maria-ituverava-sp  -- página do estabelecimento
```

A URL `categoria-em-cidade` reflete a query natural do usuário. O `<title>` da página segue o mesmo padrão: `"Lanchonete em Ituverava, SP — [Nome do Site]"`.

### Geração estática das páginas de listagem

- `generateStaticParams` gera no build todas as combinações cidade × categoria que tenham ao menos 1 comércio publicado
- Páginas com 0 resultados **não são geradas** no build (evita páginas vazias indexadas)
- Se um novo comércio é cadastrado em uma cidade/categoria ainda sem página, `revalidatePath` cria a rota dinamicamente na primeira visita (fallback: `'blocking'`)

### Metadados dinâmicos (por página de listagem)

```ts
// Gerado via generateMetadata()
title: "Lanchonete em Ituverava, SP"
description: "Encontre lanchonetes em Ituverava, SP: cardápios, horários e formas de atendimento. X estabelecimentos cadastrados."
canonical: "https://site.com/restaurantes/sp/ituverava/lanchonete"
og:image: imagem padrão do site (sem geração dinâmica por ora)
```

### Schema.org (dados estruturados)

Cada página de comércio inclui JSON-LD com `LocalBusiness` (ou subtipo como `Restaurant`, `Bakery`, etc.):

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Lanchonete da Maria",
  "address": { "@type": "PostalAddress", "addressLocality": "Ituverava", "addressRegion": "SP" },
  "telephone": "...",
  "servesCuisine": "Lanchonete",
  "openingHours": ["Mo-Fr 11:00-22:00"],
  "hasMenu": "https://site.com/comercio/lanchonete-da-maria-ituverava-sp"
}
```

Páginas de listagem incluem `ItemList` apontando para os comércios exibidos.

### Sitemap

`/sitemap.xml` gerado dinamicamente pelo Next.js (`app/sitemap.ts`) com:
- Todas as páginas de listagem cidade × categoria
- Todas as páginas de comércio publicadas
- Prioridade maior para cidades com mais comércios

### Qualidade de conteúdo e prevenção de thin content

O risco de thin content não está na quantidade de comércios por página, mas na qualidade do conteúdo de cada comércio. Uma listagem com 1 resultado rico (cardápio completo, horários, descrição) é genuinamente útil e não será penalizada.

**Requisitos mínimos para publicação do comércio**

Um comércio só pode ser publicado (e portanto indexado) se atender a todos os critérios:

| Campo | Requisito mínimo |
|---|---|
| Nome | Obrigatório |
| Descrição | Mínimo 80 caracteres |
| Endereço + cidade + estado | Obrigatório |
| Telefone ou WhatsApp | Ao menos um |
| Categoria | Ao menos uma |
| Modalidade de atendimento | Ao menos uma |
| Cardápio (Markdown) | Mínimo 150 caracteres |
| Horários de funcionamento | Ao menos 1 dia cadastrado |

O dashboard exibe um **indicador de completude** (ex: barra de progresso ou checklist) orientando o dono a preencher os campos — sem bloquear o uso, mas deixando claro que páginas mais completas têm melhor desempenho na busca.

**Conteúdo estático nas páginas de listagem**

Páginas de listagem cidade × categoria incluem um parágrafo introdutório gerado a partir de template, independente da quantidade de resultados:

```
"Encontre lanchonetes em Ituverava, SP. Veja cardápios, horários de
funcionamento e formas de atendimento — entrega, consumo no local
ou retirada."
```

Isso garante que mesmo uma página com 1 resultado tenha contexto textual suficiente além do card do comércio.

**Regra de indexação**

- 0 comércios publicados → página não gerada (sem `noindex`, simplesmente não existe)
- 1+ comércios publicados, todos com conteúdo mínimo → página gerada e indexável
- Comércio despublicado ou abaixo do mínimo → excluído da listagem e do sitemap; `revalidatePath` acionado

### Modelo de dados adicional para SEO

```
city
  id              TEXT PK
  slug            TEXT UNIQUE  -- "ituverava", "sao-joaquim-da-barra"
  name            TEXT         -- "Ituverava", "São Joaquim da Barra"
  state           TEXT         -- "SP", "MG"
  ibge_code       TEXT UNIQUE  -- código IBGE para referência
  population      INTEGER      -- permite filtrar por porte de cidade
```

O campo `population` permite evoluir a estratégia: focar primeiro em cidades abaixo de 50k, depois expandir.

---

## Estrutura de Rotas (Next.js App Router)

```
app/
  (public)/
    page.tsx                                    -- Home: busca por cidade/categoria
    sitemap.ts                                  -- Sitemap dinâmico
    robots.ts

    restaurantes/
      [estado]/
        [cidade]/
          page.tsx                              -- Listagem cidade (todos os comércios)
          [categoria]/
            page.tsx                            -- Listagem cidade × categoria (alvo SEO)

    comercio/
      [slug]/
        page.tsx                                -- Página pública do comércio + cardápio

  (auth)/
    login/page.tsx
    cadastro/page.tsx

  dashboard/
    layout.tsx                                  -- Layout autenticado
    page.tsx                                    -- Resumo do comércio
    perfil/page.tsx                             -- Editar dados do estabelecimento
    cardapio/page.tsx                           -- Editor Markdown do cardápio
    horarios/page.tsx                           -- Gerenciar horários

  api/
    auth/[...nextauth]/route.ts
    commerce/route.ts                           -- CRUD comércio
    menu/route.ts                               -- Salvar cardápio (dispara revalidação ISR)
```

---

## Estratégia de Cache / ISR

| Rota | Estratégia | Revalidação |
|---|---|---|
| `/comercio/[slug]` | SSG + ISR | `revalidatePath` quando o dono salva alterações |
| `/restaurantes/[estado]/[cidade]/[categoria]` | SSG + ISR fallback blocking | `revalidatePath` ao publicar novo comércio |
| `/restaurantes/[estado]/[cidade]` | SSG + ISR | `revalidate = 3600` |
| `/` (home) | SSG | `revalidate = 86400` |

- Fallback `blocking`: se a combinação cidade × categoria não existia ainda (novo comércio em nova cidade), a rota é gerada na primeira requisição e cacheada daí em diante — sem página 404 e sem necessidade de redeploy

---

## Filtro de Localidade

1. Visitante fornece cidade/CEP ou permite geolocalização do browser
2. Nominatim converte para lat/lng (geocoding, sem custo)
3. Query no SQLite filtra por cidade (exato) **ou** calcula distância via Haversine em memória para raio personalizado
4. Filtros adicionais (categoria, modalidade) aplicados via WHERE no banco

Para volumes maiores no futuro: índice geoespacial com extensão `spatialite` ou migração para PostgreSQL + PostGIS.

---

## Imagens

### Logo do comércio

Upload simples na página de perfil do dashboard:

1. Usuário seleciona o arquivo
2. Frontend solicita presigned PUT URL via `POST /api/upload/logo`
3. Browser faz upload direto ao R2 (sem passar pelo servidor Next.js)
4. URL pública salva no campo `logo_url` da tabela `commerce`

Restrições: JPEG/PNG/WebP, máximo 2 MB.

### Imagens no cardápio (Markdown)

O editor de Markdown suporta inserção de imagens por arrastar-e-soltar ou via botão na toolbar customizada:

1. Usuário arrasta uma imagem para o editor (ou clica em "Inserir imagem")
2. Frontend solicita presigned PUT URL via `POST /api/upload/menu-image`
3. Browser faz upload direto ao R2
4. Editor insere automaticamente `![descrição](https://cdn.site.com/...)` na posição do cursor

O fluxo é idêntico ao do GitHub: o servidor Next.js nunca manipula o binário — apenas assina a URL. O upload vai direto do browser para o R2.

```
commerce/
  [commerce-id]/
    logo.[ext]
    menu/
      [uuid].[ext]
      [uuid].[ext]
```

Restrições por imagem de cardápio: JPEG/PNG/WebP, máximo 3 MB. Limite sugerido de 20 imagens por comércio (revisável).

### Renderização das imagens no lado público

O domínio do R2 (`pub.r2.dev` ou domínio customizado) é configurado como `remotePattern` no `next.config.ts`, permitindo o uso do componente `<Image>` do Next.js com otimização automática (redimensionamento, conversão para WebP, lazy loading).

```ts
// next.config.ts
images: {
  remotePatterns: [{ hostname: 'cdn.site.com' }]
}
```

### Modelo de dados (adição)

```
commerce
  + logo_url  TEXT (nullable)   -- URL pública do R2
```

---

## Cardápio em Markdown

Cada comércio tem um único documento Markdown livre. Recomenda-se uma convenção opcional documentada para o usuário, como:

```markdown
## Entradas

| Item | Preço |
|---|---|
| Caldo de cana | R$ 5,00 |
| Pastel de queijo | R$ 8,00 |

## Pratos

### Executivo (seg-sex)
- Frango grelhado com arroz e feijão — **R$ 22,00**
- Peixe frito com pirão — **R$ 25,00**

## Bebidas
...
```

O Markdown é sanitizado antes de renderizar no lado do cliente (DOMPurify) e também pode ser renderizado server-side via `marked` para evitar JS extra.

---

## Pontos em Aberto / Decisões Futuras

| Tema | Status |
|---|---|
| Plano pago para comércios (destaque, analytics) | Fora do escopo inicial |
| Upload de imagens (logo, fotos) | Definido — Cloudflare R2 com presigned URLs |
| Avaliações / reviews de clientes | Fora do escopo inicial |
| Multi-idioma | Fora do escopo inicial |
| App mobile | Fora do escopo inicial |
| Moderação de conteúdo | Manual inicialmente |
| Rate limiting na API | Necessário antes de produção |
| Seed inicial de cidades brasileiras | Importar tabela IBGE com municípios + população |
| Páginas de cidade sem comércios | Não indexar (noindex) ou não gerar — evitar thin content |

---

## Próximos Passos

1. Validar modelo de dados e rotas com o time
2. Configurar repositório: Next.js 15 + Drizzle + Turso + Tailwind
3. Implementar autenticação (Auth.js)
4. Construir fluxo de cadastro e edição de comércio
5. Construir editor de cardápio com preview
6. Construir página pública com ISR
7. Implementar filtros de busca
8. Testes de carga leve e auditoria de segurança
