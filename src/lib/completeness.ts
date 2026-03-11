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
