import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { commerces, menus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { MenuEditor } from '@/components/dashboard/menu-editor';

export default async function CardapioPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const db = await getDb();
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
