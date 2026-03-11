# TASK 1 — Scaffolding e Infraestrutura

## Pré-requisito
Esta é a primeira task. Não há pré-requisito anterior.

Verifique apenas que o diretório de trabalho é `C:\Users\denni\projects\food-marketplace` e que o `SPEC.md` existe antes de começar.

---

## Objetivo
Projeto Next.js 15 rodando localmente com Tailwind, shadcn/ui configurado, variáveis de ambiente e estrutura de diretórios criada.

---

## Passos

### 1. Criar o projeto Next.js no diretório atual
O diretório já existe com `SPEC.md`. Use o ponto (`.`) para criar o projeto aqui mesmo:

```bash
cd /c/Users/denni/projects/food-marketplace
npx create-next-app@latest . --typescript --tailwind --app --turbopack --eslint --src-dir --import-alias "@/*" --yes
```

> Se pedir confirmação de sobrescrever arquivos existentes, confirme (o SPEC.md não será afetado pois create-next-app não o sobrescreve).

### 2. Instalar dependências do projeto

```bash
npm install \
  @libsql/client \
  drizzle-orm \
  next-auth@beta \
  @auth/drizzle-adapter \
  @aws-sdk/client-s3 \
  @aws-sdk/s3-request-presigner \
  resend \
  zod \
  marked \
  dompurify \
  @uiw/react-md-editor \
  @paralleldrive/cuid2
```

```bash
npm install -D \
  drizzle-kit \
  @types/dompurify \
  @types/marked \
  tsx
```

### 3. Inicializar shadcn/ui

```bash
npx shadcn@latest init --yes
```

Quando pedir configurações, use:
- Style: **Default**
- Base color: **Neutral**
- CSS variables: **Yes**

Depois instale os componentes que serão usados:

```bash
npx shadcn@latest add button input label card badge separator textarea toast progress
```

### 4. Configurar variáveis de ambiente

Crie o arquivo `.env.local` na raiz do projeto com o conteúdo abaixo (valores placeholder — serão preenchidos pelo usuário):

```env
# Banco (Turso)
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-auth-token

# Auth.js
AUTH_SECRET=your-auth-secret-generate-with-openssl-rand-base64-32
AUTH_RESEND_KEY=re_your_resend_key

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET=food-marketplace
NEXT_PUBLIC_R2_PUBLIC_URL=https://your-r2-domain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Adicione `.env.local` ao `.gitignore` se ainda não estiver (create-next-app já faz isso por padrão).

### 5. Criar arquivo `.env.example`

Copie `.env.local` para `.env.example` removendo os valores reais (só os nomes das vars).

### 6. Criar estrutura de diretórios

```bash
mkdir -p src/db/seed
mkdir -p src/lib
mkdir -p src/components/public
mkdir -p src/components/dashboard
mkdir -p src/app/\(auth\)/login
mkdir -p src/app/dashboard/perfil
mkdir -p src/app/dashboard/cardapio
mkdir -p src/app/dashboard/horarios
mkdir -p src/app/api/auth/\[...nextauth\]
mkdir -p src/app/api/commerce/hours
mkdir -p src/app/api/menu
mkdir -p src/app/api/upload/logo
mkdir -p src/app/api/upload/menu-image
mkdir -p src/app/api/cities/search
mkdir -p "src/app/restaurantes/[estado]/[cidade]/[categoria]"
mkdir -p src/app/comercio/\[slug\]
```

### 7. Configurar `drizzle.config.ts`

Crie `drizzle.config.ts` na raiz:

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} satisfies Config;
```

### 8. Configurar `next.config.ts`

Edite `next.config.ts` para adicionar os `remotePatterns` para o R2:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_R2_PUBLIC_URL
          ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
          : '*.r2.dev',
      },
    ],
  },
};

export default nextConfig;
```

### 9. Adicionar script no `package.json`

Adicione em `"scripts"`:
```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio",
"db:seed:cities": "tsx src/db/seed/cities.ts",
"db:seed:categories": "tsx src/db/seed/categories.ts"
```

---

## Verificação ✅

Execute e confirme que **todos** os itens passam antes de chamar TASK_2:

- [ ] `npm run dev` inicia sem erros em `http://localhost:3000`
- [ ] A página inicial padrão do Next.js aparece no browser
- [ ] `npx drizzle-kit studio` abre sem erros de configuração (pode dar erro de conexão com banco — ok por enquanto)
- [ ] O diretório `src/` contém: `app/`, `db/`, `lib/`, `components/`
- [ ] `.env.local` existe na raiz
- [ ] `drizzle.config.ts` existe na raiz

---

## Arquivos gerados nesta task
- `drizzle.config.ts`
- `next.config.ts` (modificado)
- `package.json` (scripts adicionados)
- `.env.local`
- `.env.example`
- Estrutura de diretórios em `src/`
