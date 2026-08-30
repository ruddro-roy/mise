export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function isPersistableStudioChange(
  state: { menuLocked: boolean; invitesSent: boolean; pendingApproval: unknown },
  previous: { menuLocked: boolean; invitesSent: boolean; pendingApproval: unknown },
): boolean {
  if (state.menuLocked !== previous.menuLocked) return true;
  if (state.invitesSent !== previous.invitesSent) return true;
  if (state.pendingApproval || previous.pendingApproval) return false;
  return state !== previous;
}

export type PersistHandlers = {
  save: (baseUpdatedAt: number) => Promise<{ updatedAt: number }>;
  onStatus?: (status: SaveStatus) => void;
  onError?: (error: Error) => void;
};

export type PersistQueue = {
  setBaseUpdatedAt: (value: number) => void;
  markDirty: () => void;
  flush: () => Promise<void>;
  applyRemoteIfClean: (updatedAt: number) => boolean;
  isDirty: () => boolean;
  bind: (handlers: Partial<PersistHandlers>) => void;
  dispose: () => void;
};

export type PersistQueueOptions = PersistHandlers & {
  delayMs?: number;
};

const liveQueues = new Map<string, PersistQueue>();

export function createPersistQueue(options: PersistQueueOptions): PersistQueue {
  const delayMs = options.delayMs ?? 350;
  const handlers: PersistHandlers = {
    save: options.save,
    onStatus: options.onStatus,
    onError: options.onError,
  };
  let baseUpdatedAt = 0;
  let revision = 0;
  let dirty = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let currentFlush: Promise<void> | null = null;

  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void runFlush();
    }, ms);
  };

  const runFlush = async () => {
    if (currentFlush) {
      await currentFlush;
      return;
    }
    if (!dirty) return;
    currentFlush = (async () => {
      const started = revision;
      handlers.onStatus?.("saving");
      try {
        const record = await handlers.save(baseUpdatedAt);
        baseUpdatedAt = record.updatedAt;
        if (revision === started) dirty = false;
        handlers.onStatus?.(dirty ? "saving" : "saved");
      } catch (error) {
        handlers.onStatus?.("error");
        handlers.onError?.(
          error instanceof Error ? error : new Error("Couldn't save the table."),
        );
      } finally {
        currentFlush = null;
      }
    })();
    await currentFlush;
    if (!disposed && dirty) schedule(0);
  };

  return {
    setBaseUpdatedAt(value) {
      if (value > baseUpdatedAt) baseUpdatedAt = value;
    },
    markDirty() {
      if (disposed) return;
      dirty = true;
      revision += 1;
      if (!currentFlush) schedule(delayMs);
    },
    async flush() {
      clearTimeout(timer);
      await runFlush();
      while (!disposed && dirty) {
        await runFlush();
      }
    },
    applyRemoteIfClean(updatedAt) {
      if (dirty || currentFlush) return false;
      if (updatedAt <= baseUpdatedAt) return false;
      baseUpdatedAt = updatedAt;
      return true;
    },
    isDirty() {
      return dirty;
    },
    bind(next) {
      if (next.save) handlers.save = next.save;
      if (next.onStatus) handlers.onStatus = next.onStatus;
      if (next.onError) handlers.onError = next.onError;
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}

export function acquireLiveQueue(partyId: string, options: PersistQueueOptions): PersistQueue {
  const existing = liveQueues.get(partyId);
  if (existing) {
    existing.bind(options);
    return existing;
  }
  const queue = createPersistQueue(options);
  const dispose = queue.dispose.bind(queue);
  queue.dispose = () => {
    dispose();
    liveQueues.delete(partyId);
  };
  liveQueues.set(partyId, queue);
  return queue;
}
