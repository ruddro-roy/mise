import { afterEach, describe, expect, it, vi } from "vitest";
import { createPersistQueue } from "./persist";

describe("createPersistQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes edits that land while a save is in flight", async () => {
    vi.useFakeTimers();
    let finishFirst: (value: { updatedAt: number }) => void = () => undefined;
    const save = vi
      .fn<(base: number) => Promise<{ updatedAt: number }>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ updatedAt: 20 });

    const queue = createPersistQueue({ delayMs: 350, save });
    queue.setBaseUpdatedAt(1);
    queue.markDirty();
    await vi.advanceTimersByTimeAsync(350);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toBe(1);

    queue.markDirty();
    finishFirst({ updatedAt: 10 });
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toBe(10);
    expect(queue.isDirty()).toBe(false);
    queue.dispose();
  });

  it("does not apply a remote snapshot while local edits are unsaved", () => {
    const queue = createPersistQueue({
      save: async () => ({ updatedAt: 2 }),
    });
    queue.setBaseUpdatedAt(1);
    queue.markDirty();
    expect(queue.applyRemoteIfClean(5)).toBe(false);
    expect(queue.isDirty()).toBe(true);
    queue.dispose();
  });
});
