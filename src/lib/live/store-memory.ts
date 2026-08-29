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

const root = globalThis as typeof globalThis & {
  __miseParties?: Map<string, PartyRecord>;
};

function sharedRows(): Map<string, PartyRecord> {
  if (!root.__miseParties) root.__miseParties = new Map();
  return root.__miseParties;
}

export const localMemoryStore = createMemoryPartyStore(sharedRows());
