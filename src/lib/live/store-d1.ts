import { eq } from "drizzle-orm";
import { getDb, parties } from "../../../db";
import type { Workspace } from "../domain/types";
import type { PartyRecord, PartyStore } from "./types";

export function createD1PartyStore(db: D1Database): PartyStore {
  const client = getDb({ DB: db });

  return {
    async get(id) {
      const [row] = await client.select().from(parties).where(eq(parties.id, id)).limit(1);
      if (!row) return null;
      return {
        id: row.id,
        workspace: JSON.parse(row.workspace) as Workspace,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      };
    },
    async put(record: PartyRecord) {
      await client
        .insert(parties)
        .values({
          id: record.id,
          workspace: JSON.stringify(record.workspace),
          updatedAt: record.updatedAt,
          createdAt: record.createdAt,
        })
        .onConflictDoUpdate({
          target: parties.id,
          set: {
            workspace: JSON.stringify(record.workspace),
            updatedAt: record.updatedAt,
          },
        });
    },
  };
}
