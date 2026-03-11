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
