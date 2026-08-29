"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { studioSnapshot, useStudioStore } from "@/lib/domain/store";
import {
  createParty,
  fetchParty,
  PartyRequestError,
  partyIdFromLocation,
  partyPath,
  saveParty,
} from "@/lib/live/api";
import { acquireLiveQueue, type SaveStatus } from "@/lib/live/persist";

export type LiveStatus = "connecting" | "live" | "local";
export type { SaveStatus };

export function useLiveParty() {
  const [partyId, setPartyId] = useState<string | null>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [updatedAt, setUpdatedAt] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const remote = useRef(false);
  const updatedAtRef = useRef(0);
  const setUpdatedAtRef = useRef(setUpdatedAt);
  const setSaveStatusRef = useRef(setSaveStatus);
  const hydrated = useStudioStore((state) => state.hydrated);
  setUpdatedAtRef.current = setUpdatedAt;
  setSaveStatusRef.current = setSaveStatus;

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const existing = partyIdFromLocation();
        let record;
        if (existing) {
          try {
            record = await fetchParty(existing);
          } catch (error) {
            if (!(error instanceof PartyRequestError) || error.status !== 404) {
              throw error;
            }
            record = await createParty();
            if (!cancelled) {
              window.history.replaceState(null, "", partyPath(record.id));
              toast.message("That table was gone. Opened a new one.");
            }
          }
        } else {
          record = await createParty();
          if (!cancelled) {
            window.history.replaceState(null, "", partyPath(record.id));
          }
        }
        if (cancelled) return;
        remote.current = true;
        useStudioStore.getState().hydrateWorkspace(record.workspace);
        remote.current = false;
        setPartyId(record.id);
        updatedAtRef.current = record.updatedAt;
        setUpdatedAt(record.updatedAt);
        setStatus("live");
      } catch {
        if (cancelled) return;
        useStudioStore.getState().setHydrated(true);
        setStatus("local");
        toast.error("Couldn't reach the live table. Working on this device only.");
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!partyId || !hydrated || status !== "live") return;

    const queue = acquireLiveQueue(partyId, {
      save: async (baseUpdatedAt) => {
        const record = await saveParty(partyId, studioSnapshot(), baseUpdatedAt);
        updatedAtRef.current = record.updatedAt;
        setUpdatedAtRef.current(record.updatedAt);
        return record;
      },
      onStatus: (next) => setSaveStatusRef.current(next),
      onError: (error) => {
        const stale = error instanceof PartyRequestError && error.status === 409;
        toast.error(
          stale
            ? "Couldn't save. Reload if the table looks wrong."
            : "Couldn't save the table. Try another edit.",
        );
      },
    });
    queue.setBaseUpdatedAt(updatedAtRef.current);

    const unsub = useStudioStore.subscribe((state, previous) => {
      if (remote.current) return;
      if (state.pendingApproval || previous.pendingApproval) return;
      if (state === previous) return;
      queue.markDirty();
    });

    const poll = window.setInterval(() => {
      void fetchParty(partyId)
        .then((record) => {
          if (!queue.applyRemoteIfClean(record.updatedAt)) return;
          remote.current = true;
          useStudioStore.getState().hydrateWorkspace(record.workspace);
          updatedAtRef.current = record.updatedAt;
          setUpdatedAtRef.current(record.updatedAt);
          remote.current = false;
        })
        .catch(() => undefined);
    }, 2000);

    const onHide = () => {
      void queue.flush();
    };
    window.addEventListener("pagehide", onHide);

    return () => {
      unsub();
      window.removeEventListener("pagehide", onHide);
      window.clearInterval(poll);
      void queue.flush();
    };
  }, [partyId, hydrated, status]);

  return { partyId, status, updatedAt, saveStatus };
}
