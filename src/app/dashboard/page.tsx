import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
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

  const db = await getDb();
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
            Status: {commerce.published ? 'Publicado' : 'Não publicado'}
          </p>
        </div>
        {canPublish && !commerce.published && (
          <form action={async () => {
            'use server';
            const { auth: getAuth } = await import('@/auth');
            const session = await getAuth();
            if (!session) return;
            const { getDb: getDatabase } = await import('@/db');
            const { commerces: commercesTable } = await import('@/db/schema');
            const { eq: eqFn } = await import('drizzle-orm');
            const { revalidatePath } = await import('next/cache');
            const { redirect } = await import('next/navigation');
            const database = await getDatabase();
            await database.update(commercesTable)
              .set({ published: true })
              .where(eqFn(commercesTable.ownerId, session.user.id));
            revalidatePath('/dashboard');
            redirect('/dashboard');
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
