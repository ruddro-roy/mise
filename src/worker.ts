import { Hono } from "hono";
import { emptyWorkspace } from "./lib/domain/sample";
import { createD1PartyStore } from "./lib/live/store-d1";
import { localMemoryStore } from "./lib/live/store-memory";
import { sanitizeWorkspace } from "./lib/live/schema";
import type { PartyStore } from "./lib/live/types";
import type { Workspace } from "./lib/domain/types";

export type WorkerEnv = {
  DB?: D1Database;
};

function newPartyId(): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replaceAll("-", "")
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return raw.slice(0, 10);
}

function storeFor(env: WorkerEnv | undefined): PartyStore {
  return env?.DB ? createD1PartyStore(env.DB) : localMemoryStore;
}

function identity(c: { req: { header: (name: string) => string | undefined } }) {
  const email = c.req.header("oai-authenticated-user-email") ?? null;
  const name = c.req.header("oai-authenticated-user-full-name") ?? null;
  return { email, name };
}

function createPartyWriteLock() {
  const tail = new Map<string, Promise<unknown>>();
  return <T>(id: string, work: () => Promise<T>): Promise<T> => {
    const previous = tail.get(id) ?? Promise.resolve();
    const run = previous.then(work, work);
    tail.set(
      id,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  };
}

export function createApp(defaultStore?: PartyStore) {
  const app = new Hono<{ Bindings: WorkerEnv }>();
  const lockPartyWrite = createPartyWriteLock();

  const resolveStore = (env: WorkerEnv | undefined) => defaultStore ?? storeFor(env);

  app.get("/api/health", (c) => {
    const who = identity(c);
    return c.json({
      ok: true,
      live: true,
      storage: c.env?.DB ? "d1" : "memory",
      signedIn: Boolean(who.email),
      visitor: who.email ? { email: who.email, name: who.name } : null,
    });
  });

  app.post("/api/parties", async (c) => {
    const store = resolveStore(c.env);
    const body = (await c.req.json().catch(() => ({}))) as { workspace?: unknown };
    const now = Date.now();
    const id = newPartyId();
    const record = {
      id,
      workspace: body.workspace ? sanitizeWorkspace(body.workspace) : emptyWorkspace(),
      updatedAt: now,
      createdAt: now,
    };
    await store.put(record);
    return c.json(record, 201);
  });

  app.get("/api/parties/:id", async (c) => {
    const record = await resolveStore(c.env).get(c.req.param("id"));
    if (!record) return c.json({ error: "Party not found" }, 404);
    return c.json(record);
  });

  app.put("/api/parties/:id", async (c) => {
    const store = resolveStore(c.env);
    const id = c.req.param("id");
    const body = (await c.req.json()) as {
      workspace?: unknown;
      baseUpdatedAt?: number;
    };
    return lockPartyWrite(id, async () => {
      const existing = await store.get(id);
      if (!existing) return c.json({ error: "Party not found" }, 404);
      if (
        typeof body.baseUpdatedAt === "number" &&
        existing.updatedAt > body.baseUpdatedAt
      ) {
        return c.json({ error: "stale", current: existing }, 409);
      }
      const record = {
        ...existing,
        workspace: sanitizeWorkspace(body.workspace) as Workspace,
        updatedAt: Math.max(Date.now(), existing.updatedAt + 1),
      };
      await store.put(record);
      return c.json(record);
    });
  });

  return app;
}

const app = createApp();

export default {
  fetch: (request: Request, env: WorkerEnv) => app.fetch(request, env),
};
