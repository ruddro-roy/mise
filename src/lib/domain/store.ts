"use client";

import { create } from "zustand";
import { createId } from "./ids";
import { emptyWorkspace, sampleWorkspace } from "./sample";
import type {
  Dish,
  EventBrief,
  Guest,
  LogEntry,
  MarketItem,
  Panel,
  PendingApproval,
  Seat,
  TableShape,
  TimelineStep,
  Touched,
  Workspace,
} from "./types";

type ApprovalResolver = (ok: boolean) => void;

type StudioState = Workspace & {
  hydrated: boolean;
  pendingApproval: PendingApproval | null;
  setHydrated: (value: boolean) => void;
  setPanel: (panel: Panel) => void;
  patchBrief: (patch: Partial<EventBrief>) => void;
  setGuests: (guests: Guest[]) => void;
  upsertGuest: (guest: Guest) => void;
  removeGuest: (id: string) => void;
  setDishes: (dishes: Dish[]) => void;
  upsertDish: (dish: Dish) => void;
  removeDish: (id: string) => void;
  setTableShape: (shape: TableShape) => void;
  setSeats: (seats: Seat[]) => void;
  assignSeat: (index: number, guestId: string | null) => void;
  setMarket: (market: MarketItem[]) => void;
  toggleMarket: (id: string, checked?: boolean) => void;
  upsertMarket: (item: MarketItem) => void;
  setTimeline: (timeline: TimelineStep[]) => void;
  addTimelineStep: (step: TimelineStep) => void;
  setMenuLocked: (locked: boolean) => void;
  setInvitesSent: (sent: boolean) => void;
  touch: (touched: Touched) => void;
  appendLog: (entry: Omit<LogEntry, "id" | "at">) => void;
  loadSample: () => void;
  reset: () => void;
  hydrateWorkspace: (workspace: Workspace) => void;
  requestApproval: (input: Omit<PendingApproval, "id">) => Promise<boolean>;
  resolveApproval: (ok: boolean) => void;
};

const approvalWaiters = new Map<string, ApprovalResolver>();

const persistShape = (state: StudioState): Workspace => ({
  brief: state.brief,
  guests: state.guests,
  dishes: state.dishes,
  table: state.table,
  market: state.market,
  timeline: state.timeline,
  log: state.log.slice(-40),
  panel: state.panel,
  menuLocked: state.menuLocked,
  invitesSent: state.invitesSent,
  lastTouched: state.lastTouched,
});

export const useStudioStore = create<StudioState>()((set, get) => ({
      ...emptyWorkspace(),
      hydrated: false,
      pendingApproval: null,
      setHydrated: (hydrated) => set({ hydrated }),
      setPanel: (panel) => set({ panel }),
      patchBrief: (patch) =>
        set({
          brief: { ...get().brief, ...patch },
          lastTouched: { kind: "brief", id: "brief", at: Date.now() },
        }),
      setGuests: (guests) => set({ guests, brief: { ...get().brief, guestCount: guests.length } }),
      upsertGuest: (guest) => {
        const guests = get().guests;
        const next = guests.some((item) => item.id === guest.id)
          ? guests.map((item) => (item.id === guest.id ? guest : item))
          : [...guests, guest];
        set({
          guests: next,
          brief: { ...get().brief, guestCount: Math.max(get().brief.guestCount, next.length) },
          lastTouched: { kind: "guest", id: guest.id, at: Date.now() },
        });
      },
      removeGuest: (id) => {
        const guests = get().guests.filter((guest) => guest.id !== id);
        set({
          guests,
          brief: { ...get().brief, guestCount: guests.length },
          table: {
            ...get().table,
            seats: get().table.seats.map((seat) =>
              seat.guestId === id ? { ...seat, guestId: null } : seat,
            ),
          },
        });
      },
      setDishes: (dishes) => set({ dishes }),
      upsertDish: (dish) => {
        const dishes = get().dishes;
        const next = dishes.some((item) => item.id === dish.id)
          ? dishes.map((item) => (item.id === dish.id ? dish : item))
          : [...dishes, dish];
        set({ dishes: next, lastTouched: { kind: "dish", id: dish.id, at: Date.now() } });
      },
      removeDish: (id) => set({ dishes: get().dishes.filter((dish) => dish.id !== id) }),
      setTableShape: (shape) => set({ table: { ...get().table, shape } }),
      setSeats: (seats) => set({ table: { ...get().table, seats } }),
      assignSeat: (index, guestId) => {
        const seats = get().table.seats.map((seat) => {
          if (seat.index === index) return { ...seat, guestId };
          if (guestId && seat.guestId === guestId) return { ...seat, guestId: null };
          return seat;
        });
        set({
          table: { ...get().table, seats },
          lastTouched: { kind: "seat", id: String(index), at: Date.now() },
        });
      },
      setMarket: (market) => set({ market }),
      toggleMarket: (id, checked) =>
        set({
          market: get().market.map((item) =>
            item.id === id ? { ...item, checked: checked ?? !item.checked } : item,
          ),
          lastTouched: { kind: "market", id, at: Date.now() },
        }),
      upsertMarket: (item) => {
        const market = get().market;
        const next = market.some((row) => row.id === item.id)
          ? market.map((row) => (row.id === item.id ? item : row))
          : [...market, item];
        set({ market: next, lastTouched: { kind: "market", id: item.id, at: Date.now() } });
      },
      setTimeline: (timeline) => set({ timeline }),
      addTimelineStep: (step) =>
        set({
          timeline: [...get().timeline, step].sort((a, b) => a.offsetMinutes - b.offsetMinutes),
          lastTouched: { kind: "step", id: step.id, at: Date.now() },
        }),
      setMenuLocked: (menuLocked) => set({ menuLocked }),
      setInvitesSent: (invitesSent) => set({ invitesSent }),
      touch: (lastTouched) => set({ lastTouched }),
      appendLog: (entry) =>
        set({
          log: [
            ...get().log,
            { ...entry, id: createId("log"), at: Date.now() },
          ].slice(-60),
        }),
      loadSample: () => set({ ...sampleWorkspace(), pendingApproval: get().pendingApproval }),
      reset: () => set({ ...emptyWorkspace(), pendingApproval: get().pendingApproval }),
      hydrateWorkspace: (workspace) =>
        set({
          ...workspace,
          pendingApproval: get().pendingApproval,
          hydrated: true,
        }),
      requestApproval: (input) => {
        const id = createId("ok");
        set({ pendingApproval: { ...input, id } });
        return new Promise<boolean>((resolve) => {
          approvalWaiters.set(id, resolve);
        });
      },
      resolveApproval: (ok) => {
        const pending = get().pendingApproval;
        if (!pending) return;
        const resolver = approvalWaiters.get(pending.id);
        approvalWaiters.delete(pending.id);
        set({ pendingApproval: null });
        resolver?.(ok);
      },
}));

export function studioSnapshot(): Workspace {
  return persistShape(useStudioStore.getState());
}
