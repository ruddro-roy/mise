import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "@/lib/domain/sample";
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
});
