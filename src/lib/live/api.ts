import type { Workspace } from "@/lib/domain/types";
import type { PartyRecord } from "./types";

export class PartyRequestError extends Error {
  readonly status: number;
  readonly current?: PartyRecord;

  constructor(message: string, status: number, current?: PartyRecord) {
    super(message);
    this.name = "PartyRequestError";
    this.status = status;
    this.current = current;
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string;
      current?: PartyRecord;
    };
    throw new PartyRequestError(
      error.error ?? `Request failed (${response.status})`,
      response.status,
      error.current,
    );
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
  attempt = 0,
): Promise<PartyRecord> {
  try {
    return await parse(
      await fetch(`/api/parties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, baseUpdatedAt }),
      }),
    );
  } catch (error) {
    if (
      error instanceof PartyRequestError &&
      error.status === 409 &&
      error.current &&
      attempt < 1
    ) {
      return saveParty(id, workspace, error.current.updatedAt, attempt + 1);
    }
    throw error;
  }
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
