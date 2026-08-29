import { drizzle } from "drizzle-orm/d1";
import { schema } from "./schema";

export function getDb(env: { DB?: D1Database }) {
  if (!env.DB) {
    throw new Error(
      'D1 binding DB is missing. Check .openai/hosting.json has "d1": "DB".',
    );
  }
  return drizzle(env.DB, { schema });
}

export { schema, parties } from "./schema";
