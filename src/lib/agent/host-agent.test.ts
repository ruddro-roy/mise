import { describe, expect, it } from "vitest";
import {
  BUSY_REPLY,
  catalogFallback,
  NO_CONTEXT_REPLY,
  runDeskTurn,
  runHostAgent,
} from "./host-agent";
import { DISH_CATALOG } from "@/lib/domain/catalog";
import { useStudioStore } from "@/lib/domain/store";
import { createModelContextPolyfill } from "@/lib/webmcp/polyfill";
import { CORE_TOOLS } from "@/lib/webmcp/tools";
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

  it("answers any unrecognized line instead of going silent", async () => {
    const { reply } = await runHostAgent("asdfzxcv", ctx({}));
    expect(reply.trim().length).toBeGreaterThan(0);
  });

  it.each([
    "Can we do sushi?",
    "I want paella as the centerpiece",
    "What about a big pot of curry?",
  ])("grounds the off-catalog ask %s in real catalog dishes", async (prompt) => {
    const { reply, steps } = await runHostAgent(prompt, ctx({}));
    expect(steps).toEqual([]);
    expect(reply).toContain("not in the catalog");
    const suggested = DISH_CATALOG.filter((dish) => reply.includes(dish.name));
    expect(suggested.length).toBeGreaterThanOrEqual(3);
  });
});

describe("catalogFallback", () => {
  it("returns null for prompts that are not about food", () => {
    expect(catalogFallback("what is the plan")).toBeNull();
    expect(catalogFallback("asdfzxcv")).toBeNull();
  });

  it("only names dishes that exist in the catalog", () => {
    const reply = catalogFallback("ramen night with tacos");
    expect(reply).not.toBeNull();
    const names = DISH_CATALOG.map((dish) => dish.name);
    for (const chunk of reply!.split(": ")[1].split(". ")[0].split(", ")) {
      expect(names).toContain(chunk);
    }
  });
});

describe("runDeskTurn", () => {
  it("still returns a visible error when the page has no model context", async () => {
    const turn = await runDeskTurn(
      "Plan Saturday dinner for 8 — two vegan, Maya has a nut allergy, $90, Italian,",
      null,
    );
    expect(turn).not.toBeNull();
    expect(turn?.userText).toContain("Plan Saturday dinner");
    expect(turn?.reply).toBe(NO_CONTEXT_REPLY);
  });

  it("does not drop a typed line while the previous turn is still busy", async () => {
    const turn = await runDeskTurn("Seat Maya away from Tom", ctx({}), { busy: true });
    expect(turn).not.toBeNull();
    expect(turn?.userText).toBe("Seat Maya away from Tom");
    expect(turn?.reply).toBe(BUSY_REPLY);
  });

  it("returns null only for blank input", async () => {
    expect(await runDeskTurn("   ", ctx({}))).toBeNull();
  });

  it("plans Saturday through the real polyfill tools", async () => {
    useStudioStore.getState().reset();
    const model = createModelContextPolyfill();
    for (const tool of CORE_TOOLS) {
      await model.registerTool(tool);
    }
    const turn = await runDeskTurn(
      "Plan Saturday dinner for 8 — two vegan, Maya has a nut allergy, $90, Italian, warm and unfussy",
      model,
    );
    expect(turn?.steps.map((step) => step.name)).toEqual(
      expect.arrayContaining([
        "set_event_brief",
        "add_guest",
        "propose_menu",
        "generate_shopping_list",
        "auto_seat",
      ]),
    );
    expect(turn?.reply.length).toBeGreaterThan(20);
    expect(turn?.reply).not.toContain("Working the table");
  });
});
