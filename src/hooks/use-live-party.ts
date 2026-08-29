"use client";

import { useEffect, useRef, useState } from "react";
import { studioSnapshot, useStudioStore } from "@/lib/domain/store";
import { createParty, fetchParty, partyIdFromLocation, partyPath, saveParty } from "@/lib/live/api";

export type LiveStatus = "connecting" | "live" | "local";

export function useLiveParty() {
  const [partyId, setPartyId] = useState<string | null>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [updatedAt, setUpdatedAt] = useState(0);
  const remote = useRef(false);
  const revision = useRef(0);
  const hydrated = useStudioStore((state) => state.hydrated);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const existing = partyIdFromLocation();
        const record = existing ? await fetchParty(existing) : await createParty();
        if (cancelled) return;
        if (!existing) {
          window.history.replaceState(null, "", partyPath(record.id));
        }
        remote.current = true;
        useStudioStore.getState().hydrateWorkspace(record.workspace);
        remote.current = false;
        setPartyId(record.id);
        setUpdatedAt(record.updatedAt);
        setStatus("live");
      } catch {
        if (cancelled) return;
        useStudioStore.getState().setHydrated(true);
        setStatus("local");
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!partyId || !hydrated || status !== "live") return;

    let timer: number | undefined;
    const push = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (remote.current) return;
        const next = revision.current;
        void saveParty(partyId, studioSnapshot(), updatedAt)
          .then((record) => {
            if (revision.current !== next) return;
            setUpdatedAt(record.updatedAt);
          })
          .catch((error: Error & { current?: { workspace: ReturnType<typeof studioSnapshot>; updatedAt: number } }) => {
            if (error.message === "stale" && error.current) {
              remote.current = true;
              useStudioStore.getState().hydrateWorkspace(error.current.workspace);
              setUpdatedAt(error.current.updatedAt);
              remote.current = false;
            }
          });
      }, 350);
    };

    const unsub = useStudioStore.subscribe((state, previous) => {
      if (remote.current) return;
      if (state.pendingApproval || previous.pendingApproval) return;
      if (state === previous) return;
      revision.current += 1;
      push();
    });

    const poll = window.setInterval(() => {
      void fetchParty(partyId)
        .then((record) => {
          if (record.updatedAt <= updatedAt) return;
          remote.current = true;
          useStudioStore.getState().hydrateWorkspace(record.workspace);
          setUpdatedAt(record.updatedAt);
          remote.current = false;
        })
        .catch(() => undefined);
    }, 2000);

    return () => {
      unsub();
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [partyId, hydrated, status, updatedAt]);

  return { partyId, status, updatedAt };
}
