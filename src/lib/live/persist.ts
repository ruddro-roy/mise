export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type PersistQueue = {
  setBaseUpdatedAt: (value: number) => void;
  markDirty: () => void;
  flush: () => Promise<void>;
  applyRemoteIfClean: (updatedAt: number) => boolean;
  isDirty: () => boolean;
  dispose: () => void;
};

export function createPersistQueue(options: {
  delayMs?: number;
  save: (baseUpdatedAt: number) => Promise<{ updatedAt: number }>;
  onStatus?: (status: SaveStatus) => void;
  onError?: (error: Error) => void;
}): PersistQueue {
  const delayMs = options.delayMs ?? 350;
  let baseUpdatedAt = 0;
  let revision = 0;
  let dirty = false;
  let inflight = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void runFlush();
    }, ms);
  };

  const runFlush = async () => {
    if (inflight || !dirty) return;
    inflight = true;
    const started = revision;
    options.onStatus?.("saving");
    try {
      const record = await options.save(baseUpdatedAt);
      baseUpdatedAt = record.updatedAt;
      if (revision === started) dirty = false;
      options.onStatus?.(dirty ? "saving" : "saved");
    } catch (error) {
      options.onStatus?.("error");
      options.onError?.(error instanceof Error ? error : new Error("Couldn't save the table."));
    } finally {
      inflight = false;
      if (!disposed && dirty) schedule(0);
    }
  };

  return {
    setBaseUpdatedAt(value) {
      baseUpdatedAt = value;
    },
    markDirty() {
      if (disposed) return;
      dirty = true;
      revision += 1;
      schedule(delayMs);
    },
    async flush() {
      clearTimeout(timer);
      await runFlush();
    },
    applyRemoteIfClean(updatedAt) {
      if (dirty || inflight) return false;
      if (updatedAt <= baseUpdatedAt) return false;
      baseUpdatedAt = updatedAt;
      return true;
    },
    isDirty() {
      return dirty;
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
