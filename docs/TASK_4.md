# TASK 4 — Dashboard: Cadastro e Perfil do Comércio

## Pré-requisito: verificar TASK 3 concluída

```bash
# Auth configurado
test -f src/auth.ts && echo "OK: auth.ts exists" || echo "FALHOU — rode TASK 3"

# Middleware existe
test -f src/middleware.ts && echo "OK: middleware exists" || echo "FALHOU — rode TASK 3"

# Dashboard layout existe
test -f src/app/dashboard/layout.tsx && echo "OK" || echo "FALHOU — rode TASK 3"
```

Se qualquer check falhar, **pare e execute TASK 3 primeiro**.

---

## Objetivo
Dono consegue cadastrar/editar o comércio, fazer upload de logo, e ver indicador de completude que controla o botão "Publicar".

---

## Passos

### 1. Criar `src/lib/r2.ts` — cliente S3 para Cloudflare R2

```ts
import { S3Client } from '@aws-sdk/client-s3';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET!;
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;
```

### 2. Criar `src/lib/completeness.ts` — indicador de completude

```ts
import type { Commerce, Menu, OperatingHours } from '@/db/schema';

export interface CompletenessData {
  commerce: Commerce | null;
  menu: Menu | null;
  hours: OperatingHours[];
  categoryCount: number;
  modalityCount: number;
}

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
}

export function getCompletenessItems(data: CompletenessData): CompletenessItem[] {
  const { commerce, menu, hours, categoryCount, modalityCount } = data;

  return [
    {
      key: 'name',
      label: 'Nome preenchido',
      done: !!commerce?.name?.trim(),
    },
    {
      key: 'description',
      label: 'Descrição com pelo menos 80 caracteres',
      done: (commerce?.description?.trim().length ?? 0) >= 80,
    },
    {
      key: 'address',
      label: 'Endereço e cidade preenchidos',
      done: !!(commerce?.address?.trim() && commerce?.cityId),
    },
    {
      key: 'contact',
      label: 'Telefone ou WhatsApp',
      done: !!(commerce?.phone?.trim() || commerce?.whatsapp?.trim()),
    },
    {
      key: 'category',
      label: 'Ao menos 1 categoria',
      done: categoryCount > 0,
    },
    {
      key: 'modality',
      label: 'Ao menos 1 modalidade de atendimento',
      done: modalityCount > 0,
    },
    {
      key: 'menu',
      label: 'Cardápio com pelo menos 150 caracteres',
      done: (menu?.content?.trim().length ?? 0) >= 150,
    },
    {
      key: 'hours',
      label: 'Ao menos 1 horário cadastrado',
      done: hours.length > 0,
    },
  ];
}

export function getCompletenessScore(data: CompletenessData): number {
  const items = getCompletenessItems(data);
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}

export function isPublishable(data: CompletenessData): boolean {
  return getCompletenessItems(data).every((i) => i.done);
}
```

### 3. Criar `src/components/dashboard/completeness-indicator.tsx`

```tsx
'use client';

import { CompletenessItem } from '@/lib/completeness';
import { Progress } from '@/components/ui/progress';

interface Props {
  items: CompletenessItem[];
  score: number;
}

export function CompletenessIndicator({ items, score }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Completude do perfil</span>
        <span className="text-gray-500">{score}%</span>
      </div>
      <Progress value={score} className="h-2" />
      <ul className="space-y-1.5 mt-3">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            <span className={item.done ? 'text-green-600' : 'text-gray-400'}>
              {item.done ? '✓' : '○'}
            </span>
            <span className={item.done ? 'text-gray-700' : 'text-gray-400'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 4. Criar API route `src/app/api/commerce/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { commerces, commerceCategories, commerceModalities } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { slugify } from '@/lib/slugify';
import { isPublishable, getCompletenessItems } from '@/lib/completeness';
import { revalidatePath } from 'next/cache';

const commerceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  address: z.string().max(300).optional(),
  cityId: z.string().optional(),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  instagram: z.string().max(100).optional(),
  categoryIds: z.array(z.string()).optional(),
  modalities: z.array(z.object({
    modality: z.enum(['delivery', 'dine_in', 'takeout']),
    deliveryRadiusKm: z.number().optional(),
  })).optional(),
  published: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
    with: {
      commerceCategories: { with: { category: true } },
      commerceModalities: true,
      menu: true,
      operatingHours: true,
    },
  });

  return NextResponse.json({ commerce });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // One commerce per user
  const existing = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (existing) return NextResponse.json({ error: 'Commerce already exists' }, { status: 409 });

  const body = await req.json();
  const parsed = commerceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const id = createId();
  const slug = slugify(`${data.name}-${id.slice(0, 6)}`);

  await db.insert(commerces).values({
    id,
    slug,
    name: data.name,
    description: data.description,
    address: data.address,
    cityId: data.cityId,
    phone: data.phone,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    ownerId: session.user.id,
  });

  if (data.categoryIds?.length) {
    await db.insert(commerceCategories).values(
      data.categoryIds.map((catId) => ({ commerceId: id, categoryId: catId }))
    );
  }

  if (data.modalities?.length) {
    await db.insert(commerceModalities).values(
      data.modalities.map((m) => ({ commerceId: id, ...m }))
    );
  }

  return NextResponse.json({ id, slug }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (!commerce) return NextResponse.json({ error: 'Commerce not found' }, { status: 404 });

  const body = await req.json();
  const parsed = commerceSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  // Handle publish toggle separately with completeness check
  if (data.published !== undefined) {
    if (data.published) {
      const [cats, mods, hours, menu] = await Promise.all([
        db.query.commerceCategories.findMany({ where: eq(commerceCategories.commerceId, commerce.id) }),
        db.query.commerceModalities.findMany({ where: eq(commerceModalities.commerceId, commerce.id) }),
        db.query.operatingHours.findMany({ where: eq(operatingHours.commerceId, commerce.id) }),
        db.query.menus.findFirst({ where: eq(menus.commerceId, commerce.id) }),
      ]);
      const ok = isPublishable({ commerce, menu: menu ?? null, hours, categoryCount: cats.length, modalityCount: mods.length });
      if (!ok) return NextResponse.json({ error: 'Commerce is not ready to publish' }, { status: 422 });
    }
  }

  const updateData: Partial<typeof commerce> = {
    updatedAt: new Date(),
  };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.cityId !== undefined) updateData.cityId = data.cityId;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.whatsapp !== undefined) updateData.whatsapp = data.whatsapp;
  if (data.instagram !== undefined) updateData.instagram = data.instagram;
  if (data.published !== undefined) updateData.published = data.published;

  await db.update(commerces).set(updateData).where(eq(commerces.id, commerce.id));

  if (data.categoryIds !== undefined) {
    await db.delete(commerceCategories).where(eq(commerceCategories.commerceId, commerce.id));
    if (data.categoryIds.length) {
      await db.insert(commerceCategories).values(
        data.categoryIds.map((catId) => ({ commerceId: commerce.id, categoryId: catId }))
      );
    }
  }

  if (data.modalities !== undefined) {
    await db.delete(commerceModalities).where(eq(commerceModalities.commerceId, commerce.id));
    if (data.modalities.length) {
      await db.insert(commerceModalities).values(
        data.modalities.map((m) => ({ commerceId: commerce.id, ...m }))
      );
    }
  }

  // Revalidate public pages if published state changed
  if (data.published !== undefined) {
    revalidatePath(`/comercio/${commerce.slug}`);
  }

  return NextResponse.json({ ok: true });
}
```

> **Nota**: Após criar este arquivo, adicione os imports faltantes (`operatingHours`, `menus`) em `import { ..., operatingHours, menus } from '@/db/schema'`.

### 5. Criar API route `src/app/api/upload/logo/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { commerces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

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
    return NextResponse.json({ error: 'Arquivo muito grande (máx 2MB)' }, { status: 400 });
  }

  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const key = `commerce/${commerce.id}/logo.${ext}`;

  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 120 }
  );

  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  // Save logo_url immediately (URL is deterministic)
  await db.update(commerces)
    .set({ logoUrl: publicUrl })
    .where(eq(commerces.id, commerce.id));

  return NextResponse.json({ uploadUrl: url, publicUrl });
}
```

### 6. Criar página de perfil `src/app/dashboard/perfil/page.tsx`

Esta é a página mais complexa do dashboard. Crie com Server Component buscando dados e um Client Component para o formulário:

```tsx
// src/app/dashboard/perfil/page.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { commerces, categories, cities, commerceCategories, commerceModalities, operatingHours, menus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ProfileForm } from '@/components/dashboard/profile-form';
import { getCompletenessItems, getCompletenessScore } from '@/lib/completeness';
import { CompletenessIndicator } from '@/components/dashboard/completeness-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function PerfilPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const [allCategories, commerce] = await Promise.all([
    db.query.categories.findMany(),
    db.query.commerces.findFirst({
      where: eq(commerces.ownerId, session.user.id),
      with: {
        commerceCategories: true,
        commerceModalities: true,
        operatingHours: true,
        menu: true,
        city: true,
      },
    }),
  ]);

  const completenessData = {
    commerce: commerce ?? null,
    menu: commerce?.menu ?? null,
    hours: commerce?.operatingHours ?? [],
    categoryCount: commerce?.commerceCategories?.length ?? 0,
    modalityCount: commerce?.commerceModalities?.length ?? 0,
  };

  const completenessItems = getCompletenessItems(completenessData);
  const score = getCompletenessScore(completenessData);

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ProfileForm
          commerce={commerce ?? null}
          allCategories={allCategories}
        />
      </div>
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completude</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletenessIndicator items={completenessItems} score={score} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### 7. Criar `src/components/dashboard/profile-form.tsx`

```tsx
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Commerce, Category } from '@/db/schema';

interface Props {
  commerce: Commerce | null;
  allCategories: Category[];
}

const MODALITIES = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'dine_in', label: 'Consumo no local' },
  { value: 'takeout', label: 'Retirada' },
] as const;

export function ProfileForm({ commerce, allCategories }: Props) {
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(commerce?.logoUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: commerce?.name ?? '',
    description: commerce?.description ?? '',
    address: commerce?.address ?? '',
    phone: commerce?.phone ?? '',
    whatsapp: commerce?.whatsapp ?? '',
    instagram: commerce?.instagram ?? '',
    citySearch: '',
    cityId: commerce?.cityId ?? '',
  });

  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);

  function toggleCat(id: string) {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleMod(val: string) {
    setSelectedMods((prev) =>
      prev.includes(val) ? prev.filter((m) => m !== val) : [...prev, val]
    );
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo(file: File): Promise<string> {
    const res = await fetch('/api/upload/logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: file.type, size: file.size }),
    });
    const { uploadUrl, publicUrl } = await res.json();
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (logoFile) await uploadLogo(logoFile);

      const method = commerce ? 'PATCH' : 'POST';
      const payload = {
        ...form,
        categoryIds: selectedCats,
        modalities: selectedMods.map((m) => ({ modality: m })),
      };

      const res = await fetch('/api/commerce', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Erro ao salvar');
      window.location.reload();
    } catch (err) {
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Informações do Comércio</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-lg object-cover border" />
            )}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                {logoPreview ? 'Trocar logo' : 'Adicionar logo'}
              </Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={handleLogoChange} />
              <p className="text-xs text-gray-500 mt-1">JPEG, PNG ou WebP. Máx 2MB.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva seu estabelecimento (mín. 80 caracteres para publicar)" />
            <p className="text-xs text-gray-500">{form.description.length} caracteres</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Rua, número, bairro" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })}
              placeholder="@seurestaurante" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Categorias</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <button key={cat.id} type="button" onClick={() => toggleCat(cat.id)}>
                <Badge variant={selectedCats.includes(cat.id) ? 'default' : 'outline'}>
                  {cat.name}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Modalidades de Atendimento</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {MODALITIES.map((m) => (
              <button key={m.value} type="button" onClick={() => toggleMod(m.value)}>
                <Badge variant={selectedMods.includes(m.value) ? 'default' : 'outline'}>
                  {m.label}
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : commerce ? 'Salvar alterações' : 'Cadastrar comércio'}
      </Button>
    </form>
  );
}
```

### 8. Atualizar `src/app/dashboard/page.tsx` com indicador de completude

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { commerces } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCompletenessItems, getCompletenessScore, isPublishable } from '@/lib/completeness';
import { CompletenessIndicator } from '@/components/dashboard/completeness-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
    with: {
      commerceCategories: true,
      commerceModalities: true,
      operatingHours: true,
      menu: true,
    },
  });

  if (!commerce) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Bem-vindo!</h1>
        <p className="text-gray-600 mb-4">Você ainda não cadastrou seu comércio.</p>
        <Button asChild>
          <Link href="/dashboard/perfil">Cadastrar agora</Link>
        </Button>
      </div>
    );
  }

  const data = {
    commerce,
    menu: commerce.menu ?? null,
    hours: commerce.operatingHours ?? [],
    categoryCount: commerce.commerceCategories?.length ?? 0,
    modalityCount: commerce.commerceModalities?.length ?? 0,
  };

  const items = getCompletenessItems(data);
  const score = getCompletenessScore(data);
  const canPublish = isPublishable(data);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{commerce.name}</h1>
          <p className="text-gray-500 text-sm">
            Status: {commerce.published ? '🟢 Publicado' : '⚫ Não publicado'}
          </p>
        </div>
        {canPublish && !commerce.published && (
          <form action={async () => {
            'use server';
            await fetch('/api/commerce', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ published: true }),
            });
          }}>
            <Button type="submit">Publicar</Button>
          </form>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Completude do perfil</CardTitle></CardHeader>
        <CardContent>
          <CompletenessIndicator items={items} score={score} />
          {!canPublish && (
            <p className="text-sm text-gray-500 mt-3">
              Complete todos os itens acima para poder publicar seu comércio.
            </p>
          )}
        </CardContent>
      </Card>

      {commerce.published && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">
              Página pública:{' '}
              <a href={`/comercio/${commerce.slug}`} target="_blank" className="underline text-blue-600">
                /comercio/{commerce.slug}
              </a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 9. Adicionar relações no schema Drizzle

Edite `src/db/schema.ts` para adicionar as relações (necessário para `.with()` funcionar):

```ts
// Adicione no final de schema.ts, após as definições de tabelas:
import { relations } from 'drizzle-orm';

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

## Verificação ✅

Execute e confirme **todos** os itens antes de chamar TASK_5:

- [ ] `npm run dev` sem erros de TypeScript
- [ ] `/dashboard/perfil` renderiza o formulário de perfil
- [ ] Criar um comércio pelo formulário → salva no banco
- [ ] Editar o comércio → alterações persistem após reload
- [ ] Upload de logo → imagem aparece no formulário
- [ ] Indicador de completude aparece e muda ao preencher campos
- [ ] Botão "Publicar" só aparece quando completude = 100%
- [ ] `npx drizzle-kit studio` → tabela `commerce` com registro criado

---

## Arquivos criados nesta task
- `src/lib/r2.ts`
- `src/lib/completeness.ts`
- `src/components/dashboard/completeness-indicator.tsx`
- `src/components/dashboard/profile-form.tsx`
- `src/app/api/commerce/route.ts`
- `src/app/api/upload/logo/route.ts`
- `src/app/dashboard/perfil/page.tsx`
- `src/app/dashboard/page.tsx` (atualizado)
- `src/db/schema.ts` (relações adicionadas)
