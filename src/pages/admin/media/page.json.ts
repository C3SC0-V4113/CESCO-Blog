import { listAdminMedia } from '@/db/queries/admin-media';
import { readPageWindow } from '@/lib/pagination';
import { getDb } from '@/lib/runtime';

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const page = readPageWindow(url.searchParams.get('page'), 20);
  return Response.json(await listAdminMedia(getDb(), page));
};
