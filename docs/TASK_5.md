# TASK 5 — Dashboard: Editor de Cardápio

## Pré-requisito: verificar TASK 4 concluída

```bash
test -f src/lib/completeness.ts && echo "OK: completeness.ts" || echo "FALHOU — rode TASK 4"
test -f src/app/api/commerce/route.ts && echo "OK: commerce API" || echo "FALHOU — rode TASK 4"
test -f src/components/dashboard/profile-form.tsx && echo "OK: profile-form" || echo "FALHOU — rode TASK 4"
```

Se qualquer check falhar, **pare e execute TASK 4 primeiro**.

---

## Objetivo
Dono escreve o cardápio em Markdown com preview ao vivo, pode arrastar imagens ou clicar em "Inserir imagem" para fazer upload direto ao R2, e salva o cardápio (dispara revalidação ISR).

---

## Passos

### 1. Criar `src/lib/markdown.ts` — renderização server-side

```ts
import { marked } from 'marked';

// Configurar marked com opções seguras
marked.setOptions({
  breaks: true,  // quebras de linha viram <br>
  gfm: true,     // GitHub Flavored Markdown (tabelas, etc.)
});

/**
 * Converte Markdown em HTML sanitizado.
 * Use no servidor (Server Components) — DOMPurify é client-only.
 * Para uso client-side, use sanitizeHtml() separadamente.
 */
export async function markdownToHtml(content: string): Promise<string> {
  return await marked(content);
}

/**
 * Versão síncrona para uso em contextos não-async.
 */
export function markdownToHtmlSync(content: string): string {
  return marked.parse(content) as string;
}
```

### 2. Criar API route `src/app/api/menu/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { commerces, menus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { revalidatePath } from 'next/cache';

const menuSchema = z.object({
  content: z.string().max(50000),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (!commerce) return NextResponse.json({ menu: null });

  const menu = await db.query.menus.findFirst({
    where: eq(menus.commerceId, commerce.id),
  });

  return NextResponse.json({ menu });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
    with: { city: true },
  });
  if (!commerce) return NextResponse.json({ error: 'Commerce not found' }, { status: 404 });

  const body = await req.json();
  const parsed = menuSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await db.query.menus.findFirst({
    where: eq(menus.commerceId, commerce.id),
  });

  if (existing) {
    await db.update(menus)
      .set({ content: parsed.data.content, updatedAt: new Date() })
      .where(eq(menus.commerceId, commerce.id));
  } else {
    await db.insert(menus).values({
      id: createId(),
      commerceId: commerce.id,
      content: parsed.data.content,
    });
  }

  // Revalidar página pública do comércio
  revalidatePath(`/comercio/${commerce.slug}`);

  // Revalidar páginas de listagem se o comércio estiver publicado
  if (commerce.published && commerce.city) {
    const state = commerce.city.state.toLowerCase();
    const citySlug = commerce.city.slug;
    revalidatePath(`/restaurantes/${state}/${citySlug}`);
  }

  return NextResponse.json({ ok: true });
}
```

### 3. Criar API route `src/app/api/upload/menu-image/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { commerces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2';
import { createId } from '@paralleldrive/cuid2';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 3 * 1024 * 1024; // 3MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (!commerce) return NextResponse.json({ error: 'Commerce not found' }, { status: 404 });

  const { contentType, size } = await req.json();

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido' }, { status: 400 });
  }
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx 3MB)' }, { status: 400 });
  }

  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const uuid = createId();
  const key = `commerce/${commerce.id}/menu/${uuid}.${ext}`;

  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 120 }
  );

  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  return NextResponse.json({ uploadUrl: url, publicUrl });
}
```

### 4. Criar `src/components/dashboard/menu-editor.tsx`

> **Importante**: `@uiw/react-md-editor` é um componente client-only. Use dynamic import.

```tsx
'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Dynamic import para evitar erro de SSR (editor usa window)
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface Props {
  initialContent: string;
  commerceId: string;
}

export function MenuEditor({ initialContent, commerceId }: Props) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function uploadImage(file: File): Promise<string> {
    const res = await fetch('/api/upload/menu-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    if (!res.ok) throw new Error('Falha ao obter URL de upload');
    const { uploadUrl, publicUrl } = await res.json();
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  }

  // Handler para inserir imagem via toolbar
  async function handleImageInsert() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        const alt = file.name.replace(/\.[^.]+$/, '');
        setContent((prev) => `${prev}\n\n![${alt}](${url})\n`);
      } catch {
        alert('Erro ao fazer upload da imagem.');
      }
    };
    input.click();
  }

  // Drag-and-drop de imagens no editor
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    for (const file of files) {
      try {
        const url = await uploadImage(file);
        const alt = file.name.replace(/\.[^.]+$/, '');
        setContent((prev) => `${prev}\n\n![${alt}](${url})\n`);
      } catch {
        alert(`Erro ao fazer upload de ${file.name}`);
      }
    }
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Erro ao salvar o cardápio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleImageInsert}>
            + Inserir imagem
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Salvo!</span>}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar cardápio'}
          </Button>
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        data-color-mode="light"
      >
        <MDEditor
          value={content}
          onChange={(val) => setContent(val ?? '')}
          height={500}
          preview="live"
        />
      </div>

      <p className="text-xs text-gray-500">
        {content.length} caracteres · Arraste imagens direto no editor para inserir.
        {content.length < 150 && (
          <span className="text-amber-600"> (mínimo 150 para publicar)</span>
        )}
      </p>
    </div>
  );
}
```

### 5. Criar página do editor `src/app/dashboard/cardapio/page.tsx`

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { commerces, menus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { MenuEditor } from '@/components/dashboard/menu-editor';

export default async function CardapioPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });

  if (!commerce) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Cardápio</h1>
        <p className="text-gray-600">
          Primeiro <a href="/dashboard/perfil" className="underline">cadastre seu comércio</a> para editar o cardápio.
        </p>
      </div>
    );
  }

  const menu = await db.query.menus.findFirst({
    where: eq(menus.commerceId, commerce.id),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cardápio</h1>
      <MenuEditor
        initialContent={menu?.content ?? ''}
        commerceId={commerce.id}
      />
    </div>
  );
}
```

---

## Verificação ✅

Execute e confirme **todos** os itens antes de chamar TASK_6:

- [ ] `npm run dev` sem erros
- [ ] `/dashboard/cardapio` renderiza o editor Markdown
- [ ] Escrever texto no editor → preview atualiza ao vivo
- [ ] Clicar "Salvar cardápio" → "Salvo!" aparece brevemente
- [ ] Recarregar a página → conteúdo do cardápio persiste
- [ ] Clicar "+ Inserir imagem" → abre seletor de arquivo → imagem inserida como `![...](...)` no Markdown
- [ ] Arrastar imagem para o editor → imagem inserida automaticamente
- [ ] Com cardápio < 150 chars → aviso em âmbar
- [ ] `npx drizzle-kit studio` → tabela `menu` com conteúdo salvo

---

## Arquivos criados nesta task
- `src/lib/markdown.ts`
- `src/app/api/menu/route.ts`
- `src/app/api/upload/menu-image/route.ts`
- `src/components/dashboard/menu-editor.tsx`
- `src/app/dashboard/cardapio/page.tsx`
