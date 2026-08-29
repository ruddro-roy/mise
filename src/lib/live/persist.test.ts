import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireLiveQueue, createPersistQueue } from "./persist";

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

  it("keeps the newer token when a remount reseeds an older baseUpdatedAt", async () => {
    const save = vi
      .fn<(base: number) => Promise<{ updatedAt: number }>>()
      .mockResolvedValueOnce({ updatedAt: 20 })
      .mockResolvedValueOnce({ updatedAt: 30 });

    const queue = createPersistQueue({ delayMs: 0, save });
    queue.setBaseUpdatedAt(10);
    queue.markDirty();
    await queue.flush();
    expect(save.mock.calls[0]?.[0]).toBe(10);

    queue.setBaseUpdatedAt(10);
    queue.markDirty();
    await queue.flush();
    expect(save.mock.calls[1]?.[0]).toBe(20);
    queue.dispose();
  });

  it("flush waits for the in-flight save and then writes the coalesced workspace", async () => {
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
    const flushed = queue.flush();
    expect(save).toHaveBeenCalledTimes(1);

    queue.markDirty();
    finishFirst({ updatedAt: 10 });
    await flushed;
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toBe(10);
    expect(queue.isDirty()).toBe(false);
    queue.dispose();
  });
});

describe("acquireLiveQueue", () => {
  it("reuses one queue per party so overlapping mounts stay sequential", async () => {
    const save = vi
      .fn<(base: number) => Promise<{ updatedAt: number }>>()
      .mockResolvedValue({ updatedAt: 2 });
    const first = acquireLiveQueue("party-a", { delayMs: 0, save });
    const second = acquireLiveQueue("party-a", { delayMs: 0, save });
    expect(second).toBe(first);
    first.setBaseUpdatedAt(1);
    first.markDirty();
    second.markDirty();
    await first.flush();
    expect(save).toHaveBeenCalledTimes(1);
    first.dispose();
  });
});
