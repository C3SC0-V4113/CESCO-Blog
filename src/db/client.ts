/// <reference types="@cloudflare/workers-types" />

import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

export function createDb(database: D1Database) {
  return drizzle(database, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { schema };
