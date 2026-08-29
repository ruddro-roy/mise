import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyWorkspace } from "@/lib/domain/sample";
import { saveParty } from "./api";

describe("saveParty", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a 409 with the local workspace and the server clock", async () => {
    const workspace = emptyWorkspace();
    workspace.brief.title = "Saturday dinner";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "stale",
            current: {
              id: "abc123abcd",
              workspace: emptyWorkspace(),
              updatedAt: 200,
              createdAt: 100,
            },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "abc123abcd",
            workspace,
            updatedAt: 300,
            createdAt: 100,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const record = await saveParty("abc123abcd", workspace, 100);
    expect(record.updatedAt).toBe(300);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      baseUpdatedAt: number;
      workspace: { brief: { title: string } };
    };
    expect(second.baseUpdatedAt).toBe(200);
    expect(second.workspace.brief.title).toBe("Saturday dinner");
  });
});
