import { describe, expect, it } from "vitest";
import { runHostAgent } from "./host-agent";
import type { ModelContext, RegisteredTool } from "@/lib/webmcp/types";

function tool(name: string): RegisteredTool {
  return {
    name,
    title: name,
    description: name,
    inputSchema: { type: "object" },
    annotations: {},
    origin: "test",
  };
}

function ctx(results: Record<string, unknown>): ModelContext {
  return {
    async getTools() {
      return Object.keys(results).map(tool);
    },
    async executeTool(registered) {
      return JSON.stringify(results[registered.name] ?? { ok: false });
    },
    registerTool: async () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    ontoolchange: null,
  };
}

describe("runHostAgent", () => {
  it("asks to lock the menu for book it", async () => {
    const { reply, steps } = await runHostAgent(
      "book it",
      ctx({ lock_menu: { ok: true, locked: true } }),
    );
    expect(steps.map((step) => step.name)).toEqual(["lock_menu"]);
    expect(reply).toBe("The menu is locked.");
  });

  it("explains an empty table instead of dumping state", async () => {
    const { reply, steps } = await runHostAgent("get_workspace_state", ctx({}));
    expect(steps).toEqual([]);
    expect(reply).toBe("I can plan dinner, lock the menu, or send invites.");
  });
});
