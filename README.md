# Comer na Cidade

Catálogo digital de comércios locais — restaurantes, padarias, lanchonetes e mais, organizados por cidade e categoria.

**Site:** [comernacidade.com.br](https://comernacidade.com.br)

## Stack

- **Next.js 16** (App Router + Turbopack) + **React 19** + **TypeScript**
- **Drizzle ORM** + **Turso** (libsql) — SQLite-compatível, edge-ready
- **Auth.js v5** — magic link via Resend, sem senhas
- **Tailwind v4** + **shadcn/ui v4** — cores oklch, variáveis CSS, primitivos Radix
- **Cloudflare R2** — armazenamento de imagens via S3 presigned URLs

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env.local
# Preencher as variáveis em .env.local

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL de conexão Turso |
| `DATABASE_AUTH_TOKEN` | Token de autenticação Turso |
| `AUTH_SECRET` | Segredo Auth.js (`openssl rand -base64 32`) |
| `AUTH_RESEND_KEY` | Chave da API Resend (magic link) |
| `NEXT_PUBLIC_APP_URL` | URL raiz da aplicação |
| `R2_ACCOUNT_ID` | ID da conta Cloudflare |
| `R2_ACCESS_KEY_ID` | Access key R2 |
| `R2_SECRET_ACCESS_KEY` | Secret key R2 |
| `R2_BUCKET` | Nome do bucket R2 |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | URL pública do bucket R2 |

## Comandos

```bash
npm run dev                   # Servidor de desenvolvimento (Turbopack)
npm run build                 # Build de produção
npm run lint                  # ESLint

npm run db:generate           # Gerar migrations (Drizzle)
npm run db:migrate            # Aplicar migrations no Turso
npm run db:studio             # Abrir Drizzle Studio (GUI do banco)
npm run db:seed:cities        # Seed de ~5570 cidades brasileiras
npm run db:seed:categories    # Seed de 12 categorias de comida
```

## Estrutura de Rotas

| Rota | Descrição |
|---|---|
| `/` | Home com busca por cidade |
| `/comercio/[slug]` | Página individual do comércio |
| `/restaurantes/[estado]/[cidade]` | Listagem por cidade |
| `/restaurantes/[estado]/[cidade]/[categoria]` | Listagem por cidade e categoria |
| `/dashboard` | Painel do dono (protegido) |
| `/dashboard/perfil` | Perfil e dados do comércio |
| `/dashboard/cardapio` | Editor de cardápio (Markdown) |
| `/dashboard/horarios` | Horários de funcionamento |
