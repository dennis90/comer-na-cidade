import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { commerces, categories, commerceCategories, commerceModalities, operatingHours, menus } from '@/db/schema';
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
          initialCategoryIds={commerce?.commerceCategories?.map((cc) => cc.categoryId) ?? []}
          initialModalityValues={commerce?.commerceModalities?.map((cm) => cm.modality) ?? []}
          initialCity={commerce?.city ?? null}
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
