"use client";

import { useStudioStore } from "@/lib/domain/store";
import type { Panel } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const ITEMS: { id: Panel; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "guests", label: "Guests" },
  { id: "menu", label: "Menu" },
  { id: "seating", label: "Seating" },
  { id: "market", label: "Market" },
  { id: "run", label: "Run of show" },
];

export function PanelNav() {
  const panel = useStudioStore((state) => state.panel);
  const setPanel = useStudioStore((state) => state.setPanel);
  const guests = useStudioStore((state) => state.guests.length);
  const dishes = useStudioStore((state) => state.dishes.length);
  const seated = useStudioStore(
    (state) => state.table.seats.filter((seat) => seat.guestId).length,
  );
  const market = useStudioStore((state) => state.market.length);
  const timeline = useStudioStore((state) => state.timeline.length);
  const snapshot = { guests, dishes, seated, market, timeline };

  return (
    <nav
      aria-label="Studio panels"
      className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:flex-col md:overflow-visible md:border-r md:border-b-0 md:px-3 md:py-5"
    >
      {ITEMS.map((item) => {
        const count =
          item.id === "guests"
            ? snapshot.guests
            : item.id === "menu"
              ? snapshot.dishes
              : item.id === "seating"
                ? snapshot.seated
                : item.id === "market"
                  ? snapshot.market
                  : item.id === "run"
                    ? snapshot.timeline
                    : 0;
        const active = panel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setPanel(item.id)}
            className={cn(
              "flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span>{item.label}</span>
            {item.id !== "brief" ? (
              <span
                className={cn(
                  "tabular-nums text-[11px]",
                  active ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
