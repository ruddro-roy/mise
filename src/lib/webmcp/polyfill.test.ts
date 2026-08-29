import { describe, expect, it } from "vitest";
import { createModelContextPolyfill } from "./polyfill";

describe("WebMCP polyfill", () => {
  it("registers, lists, executes, and unregisters with AbortSignal", async () => {
    const ctx = createModelContextPolyfill();
    const controller = new AbortController();
    let changes = 0;
    ctx.addEventListener("toolchange", () => {
      changes += 1;
    });

    await ctx.registerTool(
      {
        name: "echo_tool",
        description: "Echo",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
        annotations: { readOnlyHint: true },
        execute: (input) => ({ heard: input.text }),
      },
      { signal: controller.signal },
    );

    const tools = await ctx.getTools();
    expect(tools.map((tool) => tool.name)).toEqual(["echo_tool"]);
    const raw = await ctx.executeTool(tools[0], JSON.stringify({ text: "hello" }));
    expect(raw).toBe(JSON.stringify({ heard: "hello" }));

    controller.abort();
    expect((await ctx.getTools()).map((tool) => tool.name)).toEqual([]);
    expect(changes).toBeGreaterThanOrEqual(2);
  });

  it("rejects illegal tool names", async () => {
    const ctx = createModelContextPolyfill();
    await expect(
      ctx.registerTool({
        name: "has a space",
        description: "Bad",
        execute: () => "no",
      }),
    ).rejects.toThrow(/letters/);
  });
});
