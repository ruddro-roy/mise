import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "@/lib/domain/sample";
import { createPersistQueue } from "@/lib/live/persist";
import { createMemoryPartyStore } from "@/lib/live/store-memory";
import { createApp } from "@/worker";

describe("live party API", () => {
  it("creates, reads, and updates a dinner on the worker", async () => {
    const app = createApp(createMemoryPartyStore());
    const created = await app.request("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: emptyWorkspace() }),
    });
    expect(created.status).toBe(201);
    const party = (await created.json()) as { id: string; updatedAt: number };
    expect(party.id).toHaveLength(10);

    const read = await app.request(`/api/parties/${party.id}`);
    expect(read.status).toBe(200);

    const next = emptyWorkspace();
    next.brief.title = "Saturday at Maya's";
    const saved = await app.request(`/api/parties/${party.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: next, baseUpdatedAt: party.updatedAt }),
    });
    expect(saved.status).toBe(200);
    const body = (await saved.json()) as { workspace: { brief: { title: string } } };
    expect(body.workspace.brief.title).toBe("Saturday at Maya's");
  });

  it("rejects a stale write with 409 and the current record", async () => {
    const app = createApp(createMemoryPartyStore());
    const created = await app.request("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: emptyWorkspace() }),
    });
    const party = (await created.json()) as { id: string; updatedAt: number };
    const first = emptyWorkspace();
    first.brief.title = "First save";
    await app.request(`/api/parties/${party.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: first, baseUpdatedAt: party.updatedAt }),
    });

    const stale = emptyWorkspace();
    stale.brief.title = "Lost write";
    const conflict = await app.request(`/api/parties/${party.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: stale, baseUpdatedAt: party.updatedAt }),
    });
    expect(conflict.status).toBe(409);
    const body = (await conflict.json()) as {
      error: string;
      current: { workspace: { brief: { title: string } } };
    };
    expect(body.error).toBe("stale");
    expect(body.current.workspace.brief.title).toBe("First save");
  });

  it("serializes rapid queued saves so none hit 409 on the memory store", async () => {
    const app = createApp(createMemoryPartyStore());
    const created = await app.request("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: emptyWorkspace() }),
    });
    const party = (await created.json()) as { id: string; updatedAt: number };

    const statuses: number[] = [];
    const tokens: number[] = [];
    let title = "";
    const queue = createPersistQueue({
      delayMs: 0,
      save: async (baseUpdatedAt) => {
        tokens.push(baseUpdatedAt);
        const workspace = emptyWorkspace();
        workspace.brief.title = title;
        const response = await app.request(`/api/parties/${party.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace, baseUpdatedAt }),
        });
        statuses.push(response.status);
        if (!response.ok) throw new Error(`save failed (${response.status})`);
        return (await response.json()) as { updatedAt: number };
      },
    });
    queue.setBaseUpdatedAt(party.updatedAt);

    for (let edit = 1; edit <= 5; edit += 1) {
      title = `Edit ${edit}`;
      queue.markDirty();
      await Promise.resolve();
    }
    while (queue.isDirty()) {
      await queue.flush();
    }
    queue.dispose();

    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(tokens).toEqual([...tokens].sort((a, b) => a - b));
    expect(new Set(tokens).size).toBe(tokens.length);

    const read = await app.request(`/api/parties/${party.id}`);
    const record = (await read.json()) as { workspace: { brief: { title: string } } };
    expect(record.workspace.brief.title).toBe("Edit 5");
  });
});
