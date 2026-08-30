import { describe, expect, it } from "vitest";
import { useStudioStore } from "@/lib/domain/store";
import { createModelContextPolyfill } from "@/lib/webmcp/polyfill";
import { CORE_TOOLS } from "@/lib/webmcp/tools";
import { isPersistableStudioChange } from "@/lib/live/persist";

async function registerCore() {
  const model = createModelContextPolyfill();
  for (const tool of CORE_TOOLS) {
    await model.registerTool(tool);
  }
  return model;
}

function lockTool(model: Awaited<ReturnType<typeof registerCore>>) {
  return model.getTools().then((tools) => {
    const tool = tools.find((item) => item.name === "lock_menu");
    if (!tool) throw new Error("lock_menu is not registered");
    return tool;
  });
}

describe("lock_menu", () => {
  it("waits for one host confirm, then freezes the menu", async () => {
    useStudioStore.getState().reset();
    useStudioStore.getState().loadSample();
    useStudioStore.getState().setMenuLocked(false);

    const model = await registerCore();
    const pending = model.executeTool(await lockTool(model), "{}");
    expect(useStudioStore.getState().pendingApproval?.tool).toBe("lock_menu");

    useStudioStore.getState().resolveApproval(true);
    useStudioStore.getState().resolveApproval(false);

    const raw = JSON.parse(String(await pending)) as {
      ok: boolean;
      locked?: boolean;
    };
    expect(raw).toEqual({ ok: true, locked: true });
    expect(useStudioStore.getState().menuLocked).toBe(true);
    expect(useStudioStore.getState().pendingApproval).toBeNull();
    expect(useStudioStore.getState().panel).toBe("menu");
  });

  it("leaves the menu open when the host declines once", async () => {
    useStudioStore.getState().reset();
    useStudioStore.getState().setMenuLocked(false);

    const model = await registerCore();
    const pending = model.executeTool(await lockTool(model), "{}");
    useStudioStore.getState().resolveApproval(false);
    useStudioStore.getState().resolveApproval(true);

    const raw = JSON.parse(String(await pending)) as { ok: boolean };
    expect(raw.ok).toBe(false);
    expect(useStudioStore.getState().menuLocked).toBe(false);
    expect(useStudioStore.getState().pendingApproval).toBeNull();
  });

  it("persists a lock even when the save queue just left an approval dialog", () => {
    expect(
      isPersistableStudioChange(
        { menuLocked: true, invitesSent: false, pendingApproval: null },
        { menuLocked: false, invitesSent: false, pendingApproval: { id: "ok_1" } },
      ),
    ).toBe(true);
    expect(
      isPersistableStudioChange(
        { menuLocked: false, invitesSent: false, pendingApproval: null },
        { menuLocked: false, invitesSent: false, pendingApproval: { id: "ok_1" } },
      ),
    ).toBe(false);
  });
});
