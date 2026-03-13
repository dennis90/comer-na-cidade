import { drizzle } from 'drizzle-orm/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from './schema';

export type DrizzleD1 = ReturnType<typeof drizzle<typeof schema>>;

export async function getDb(): Promise<DrizzleD1> {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}
