import type { Workspace } from "@/lib/domain/types";
import type { PartyRecord } from "./types";

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string;
      current?: PartyRecord;
    };
    const failure = new Error(error.error ?? `Request failed (${response.status})`);
    (failure as Error & { current?: PartyRecord }).current = error.current;
    throw failure;
  }
  return (await response.json()) as T;
}

export async function createParty(workspace?: Workspace): Promise<PartyRecord> {
  return parse(
    await fetch("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workspace ? { workspace } : {}),
    }),
  );
}

export async function fetchParty(id: string): Promise<PartyRecord> {
  return parse(await fetch(`/api/parties/${id}`));
}

export async function saveParty(
  id: string,
  workspace: Workspace,
  baseUpdatedAt: number,
): Promise<PartyRecord> {
  return parse(
    await fetch(`/api/parties/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace, baseUpdatedAt }),
    }),
  );
}

export function partyIdFromLocation(
  url: Pick<Location, "pathname" | "search"> = window.location,
): string | null {
  const path = url.pathname.match(/^\/p\/([A-Za-z0-9_-]+)/);
  if (path) return path[1];
  return new URLSearchParams(url.search).get("p");
}

export function partyPath(id: string): string {
  return `/p/${id}`;
}
