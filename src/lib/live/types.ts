import type { Workspace } from "@/lib/domain/types";

export type PartyRecord = {
  id: string;
  workspace: Workspace;
  updatedAt: number;
  createdAt: number;
};

export type PartyStore = {
  get: (id: string) => Promise<PartyRecord | null>;
  put: (record: PartyRecord) => Promise<void>;
};
