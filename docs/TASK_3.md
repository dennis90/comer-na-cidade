# TASK 3 — Autenticação (Magic Link)

## Pré-requisito: verificar TASK 2 concluída

```bash
# Todas as migrations aplicadas
test -d drizzle && echo "OK: drizzle dir exists" || echo "FALHOU — rode TASK 2"

# Schema existe
test -f src/db/schema.ts && echo "OK: schema exists" || echo "FALHOU — rode TASK 2"

# Banco tem cidades
# (requer DATABASE_URL configurado no .env.local)
```

Se qualquer check falhar, **pare e execute TASK 2 primeiro**.

---

## Objetivo
Donos de comércio conseguem criar conta e fazer login via magic link por e-mail. Rotas `/dashboard/**` são protegidas por middleware.

---

## Passos

### 1. Criar `src/auth.ts`

```ts
import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Resend from 'next-auth/providers/resend';
import { db } from '@/db';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: 'noreply@' + (process.env.NEXT_PUBLIC_APP_URL?.replace('https://', '').replace('http://', '') ?? 'localhost'),
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/login?verify=1',
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
```

### 2. Criar `src/app/api/auth/[...nextauth]/route.ts`

```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

### 3. Criar `src/middleware.ts`

```ts
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard');

  if (isDashboard && !isLoggedIn) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

### 4. Criar página de login `src/app/(auth)/login/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const isVerify = searchParams.get('verify') === '1';
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn('resend', { email, callbackUrl, redirect: false });
    // Auth.js redireciona para /login?verify=1 automaticamente
    window.location.href = '/login?verify=1';
  }

  if (isVerify) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verifique seu e-mail</CardTitle>
            <CardDescription>
              Enviamos um link de acesso para o seu e-mail. Clique no link para entrar.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>
            Digite seu e-mail para receber um link de acesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de acesso'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5. Criar layout do dashboard `src/app/dashboard/layout.tsx`

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-sm">
              Dashboard
            </Link>
            <Link href="/dashboard/perfil" className="text-sm text-gray-600 hover:text-gray-900">
              Perfil
            </Link>
            <Link href="/dashboard/cardapio" className="text-sm text-gray-600 hover:text-gray-900">
              Cardápio
            </Link>
            <Link href="/dashboard/horarios" className="text-sm text-gray-600 hover:text-gray-900">
              Horários
            </Link>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button variant="ghost" size="sm" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
```

### 6. Criar página inicial do dashboard `src/app/dashboard/page.tsx` (placeholder)

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Bem-vindo ao Dashboard</h1>
      <p className="text-gray-600">
        Cadastre seu comércio em <a href="/dashboard/perfil" className="underline">Perfil</a>.
      </p>
    </div>
  );
}
```

### 7. Declarar tipo da sessão (TypeScript)

Crie `src/types/next-auth.d.ts`:

```ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
```

---

## Verificação ✅

Execute e confirme **todos** os itens antes de chamar TASK_4:

- [ ] `AUTH_RESEND_KEY` configurado em `.env.local` com uma chave Resend válida
- [ ] `AUTH_SECRET` configurado (gere com: `openssl rand -base64 32`)
- [ ] `npm run dev` sem erros de TypeScript relacionados a auth
- [ ] Acessar `/login` no browser — página de login aparece
- [ ] Acessar `/dashboard` sem login — redireciona para `/login`
- [ ] Digitar e-mail no form → recebe e-mail com link → clicar no link → redireciona para `/dashboard`
- [ ] Logout funciona e redireciona para `/login`

---

## Arquivos criados nesta task
- `src/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/middleware.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/types/next-auth.d.ts`
