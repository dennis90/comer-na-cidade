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
