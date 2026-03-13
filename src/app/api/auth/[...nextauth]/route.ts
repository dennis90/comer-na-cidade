import { type NextRequest } from 'next/server';
import { createAuth } from '@/auth';

export async function GET(req: NextRequest) {
  const { handlers } = await createAuth();
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const { handlers } = await createAuth();
  return handlers.POST(req);
}
