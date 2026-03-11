# TASK 6 — Dashboard: Horários de Funcionamento

## Pré-requisito: verificar TASK 5 concluída

```bash
test -f src/app/api/menu/route.ts && echo "OK: menu API" || echo "FALHOU — rode TASK 5"
test -f src/components/dashboard/menu-editor.tsx && echo "OK: menu-editor" || echo "FALHOU — rode TASK 5"
test -f src/app/dashboard/cardapio/page.tsx && echo "OK: cardapio page" || echo "FALHOU — rode TASK 5"
```

Se qualquer check falhar, **pare e execute TASK 5 primeiro**.

---

## Objetivo
Dono define horários de abertura e fechamento por dia da semana (Dom–Sab) com toggle ativo/inativo por dia.

---

## Passos

### 1. Criar API route `src/app/api/commerce/hours/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { commerces, operatingHours } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

const hourSchema = z.object({
  // Array completo de 7 dias (alguns podem ser null = fechado)
  hours: z.array(
    z.union([
      z.null(),
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        opensAt: z.string().regex(/^\d{2}:\d{2}$/),
        closesAt: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    ])
  ).length(7),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (!commerce) return NextResponse.json({ hours: [] });

  const hours = await db.query.operatingHours.findMany({
    where: eq(operatingHours.commerceId, commerce.id),
    orderBy: (h, { asc }) => asc(h.dayOfWeek),
  });

  return NextResponse.json({ hours });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });
  if (!commerce) return NextResponse.json({ error: 'Commerce not found' }, { status: 404 });

  const body = await req.json();
  const parsed = hourSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Replace all hours for this commerce
  await db.delete(operatingHours).where(eq(operatingHours.commerceId, commerce.id));

  const toInsert = parsed.data.hours
    .filter((h) => h !== null)
    .map((h) => ({
      id: createId(),
      commerceId: commerce.id,
      dayOfWeek: h!.dayOfWeek,
      opensAt: h!.opensAt,
      closesAt: h!.closesAt,
    }));

  if (toInsert.length > 0) {
    await db.insert(operatingHours).values(toInsert);
  }

  return NextResponse.json({ ok: true, saved: toInsert.length });
}
```

### 2. Criar `src/components/dashboard/hours-grid.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OperatingHours } from '@/db/schema';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface DayState {
  active: boolean;
  opensAt: string;
  closesAt: string;
}

function buildInitialState(hours: OperatingHours[]): DayState[] {
  return DAYS.map((_, i) => {
    const h = hours.find((hh) => hh.dayOfWeek === i);
    return {
      active: !!h,
      opensAt: h?.opensAt ?? '09:00',
      closesAt: h?.closesAt ?? '18:00',
    };
  });
}

interface Props {
  initialHours: OperatingHours[];
}

export function HoursGrid({ initialHours }: Props) {
  const [days, setDays] = useState<DayState[]>(buildInitialState(initialHours));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(i: number) {
    setDays((prev) => prev.map((d, idx) => idx === i ? { ...d, active: !d.active } : d));
  }

  function setTime(i: number, field: 'opensAt' | 'closesAt', value: string) {
    setDays((prev) => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const hours = days.map((d, i) =>
      d.active ? { dayOfWeek: i, opensAt: d.opensAt, closesAt: d.closesAt } : null
    );
    try {
      const res = await fetch('/api/commerce/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Erro ao salvar horários.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">Dia</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-20">Aberto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Abertura</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fechamento</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {DAYS.map((day, i) => (
              <tr key={day} className={days[i].active ? '' : 'opacity-50'}>
                <td className="px-4 py-3 font-medium">{day}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className={`w-10 h-6 rounded-full transition-colors ${
                      days[i].active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    aria-label={days[i].active ? 'Desativar' : 'Ativar'}
                  >
                    <span className={`block w-4 h-4 rounded-full bg-white shadow mx-1 transition-transform ${
                      days[i].active ? 'translate-x-4' : ''
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="time"
                    value={days[i].opensAt}
                    onChange={(e) => setTime(i, 'opensAt', e.target.value)}
                    disabled={!days[i].active}
                    className="w-32"
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="time"
                    value={days[i].closesAt}
                    onChange={(e) => setTime(i, 'closesAt', e.target.value)}
                    disabled={!days[i].active}
                    className="w-32"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        {saved && <span className="text-sm text-green-600">Horários salvos!</span>}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar horários'}
        </Button>
      </div>
    </div>
  );
}
```

### 3. Criar página de horários `src/app/dashboard/horarios/page.tsx`

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { commerces, operatingHours } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { HoursGrid } from '@/components/dashboard/hours-grid';

export default async function HorariosPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const commerce = await db.query.commerces.findFirst({
    where: eq(commerces.ownerId, session.user.id),
  });

  if (!commerce) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Horários de Funcionamento</h1>
        <p className="text-gray-600">
          Primeiro <a href="/dashboard/perfil" className="underline">cadastre seu comércio</a>.
        </p>
      </div>
    );
  }

  const hours = await db.query.operatingHours.findMany({
    where: eq(operatingHours.commerceId, commerce.id),
    orderBy: (h, { asc }) => asc(h.dayOfWeek),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Horários de Funcionamento</h1>
      <p className="text-gray-500 text-sm mb-6">
        Defina os horários de abertura e fechamento para cada dia da semana.
      </p>
      <HoursGrid initialHours={hours} />
    </div>
  );
}
```

---

## Verificação ✅

Execute e confirme **todos** os itens antes de chamar TASK_7:

- [ ] `npm run dev` sem erros
- [ ] `/dashboard/horarios` renderiza o grid semanal com 7 dias
- [ ] Toggle ativa/desativa um dia (linha fica opaca quando inativa)
- [ ] Alterar hora de abertura/fechamento de um dia ativo
- [ ] Clicar "Salvar horários" → "Horários salvos!" aparece
- [ ] Recarregar a página → horários persistem
- [ ] Dias inativos não aparecem como horários no banco (`npx drizzle-kit studio`)
- [ ] Indicador de completude no dashboard agora marca "horários" quando ao menos 1 dia está salvo

---

## Arquivos criados nesta task
- `src/app/api/commerce/hours/route.ts`
- `src/components/dashboard/hours-grid.tsx`
- `src/app/dashboard/horarios/page.tsx`
