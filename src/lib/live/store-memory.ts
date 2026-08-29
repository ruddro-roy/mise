import type { PartyRecord, PartyStore } from "./types";

export function createMemoryPartyStore(seed = new Map<string, PartyRecord>()): PartyStore {
  const rows = seed;
  return {
    async get(id) {
      return rows.get(id) ?? null;
    },
    async put(record) {
      rows.set(record.id, record);
    },
  };
}

export const localMemoryStore = createMemoryPartyStore();
