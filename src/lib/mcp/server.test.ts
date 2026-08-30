import { describe, expect, it } from "vitest";
import { createMemoryPartyStore } from "@/lib/live/store-memory";
import { createApp } from "@/worker";

type RpcResponse = {
  result?: {
    tools?: Array<{ name: string; annotations?: Record<string, boolean> }>;
    structuredContent?: Record<string, unknown>;
  };
  error?: { code: number; message: string };
};

const PUBLIC_MCP_PATH = "/api/mcp";

function rpc(method: string, params?: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method,
    ...(params ? { params } : {}),
  };
}

async function callMcp(
  app: ReturnType<typeof createApp>,
  method: string,
  params?: Record<string, unknown>,
): Promise<RpcResponse> {
  const response = await app.request(`http://localhost${PUBLIC_MCP_PATH}`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rpc(method, params)),
  });
  expect(response.status).toBe(200);
  const body = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const payloads = body
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    expect(payloads.length).toBeGreaterThan(0);
    return JSON.parse(payloads.at(-1) ?? "{}") as RpcResponse;
  }
  return JSON.parse(body) as RpcResponse;
}

describe("remote MCP server", () => {
  it("publishes a real tool catalog with safety annotations", async () => {
    const app = createApp(createMemoryPartyStore());
    const listed = await callMcp(app, "tools/list", {});

    expect(listed.error).toBeUndefined();
    const tools = listed.result?.tools ?? [];
    expect(tools.map((tool) => tool.name)).toEqual([
      "create_party",
      "get_party",
      "set_event_brief",
      "upsert_guest",
      "set_seating_preferences",
      "propose_menu",
      "substitute_dish",
      "generate_shopping_list",
      "auto_seat",
      "generate_run_of_show",
      "set_menu_lock",
      "draft_invites",
      "search_catalog",
    ]);
    expect(tools.find((tool) => tool.name === "get_party")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
    expect(tools.find((tool) => tool.name === "propose_menu")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
  });

  it("creates and edits the same persistent party used by the site", async () => {
    const app = createApp(createMemoryPartyStore());
    const created = await callMcp(app, "tools/call", {
      name: "create_party",
      arguments: { sample: false },
    });
    const partyId = created.result?.structuredContent?.party_id;
    expect(partyId).toEqual(expect.any(String));
    expect(created.result?.structuredContent?.url).toBe(
      `http://localhost/p/${partyId}`,
    );

    const changed = await callMcp(app, "tools/call", {
      name: "set_event_brief",
      arguments: {
        party_id: partyId,
        title: "Judge night",
        cuisine: "japanese",
        guest_count: 8,
        budget_usd: 160,
      },
    });
    expect(changed.result?.structuredContent).toMatchObject({
      ok: true,
      party_id: partyId,
    });

    const read = await app.request(`/api/parties/${partyId}`);
    expect(read.status).toBe(200);
    const record = (await read.json()) as {
      workspace: {
        brief: {
          title: string;
          cuisine: string;
          guestCount: number;
          budgetUsd: number;
        };
      };
    };
    expect(record.workspace.brief).toMatchObject({
      title: "Judge night",
      cuisine: "japanese",
      guestCount: 8,
      budgetUsd: 160,
    });
  });

  it("supports the initialize handshake and CORS preflight", async () => {
    const app = createApp(createMemoryPartyStore());
    const initialized = await callMcp(app, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "mise-test", version: "1.0.0" },
    });
    expect(initialized.error).toBeUndefined();
    expect(initialized.result).toMatchObject({
      serverInfo: { name: "mise-party-studio", version: "1.0.0" },
    });

    const preflight = await app.request(`http://localhost${PUBLIC_MCP_PATH}`, {
      method: "OPTIONS",
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("keeps the direct Worker /mcp endpoint available", async () => {
    const app = createApp(createMemoryPartyStore());
    const response = await app.request("http://localhost/mcp", {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rpc("tools/list", {})),
    });

    expect(response.status).toBe(200);
  });
});
