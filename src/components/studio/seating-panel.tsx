"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio/empty-state";
import { autoSeat, seatingIssues } from "@/lib/domain/planner";
import { useStudioStore } from "@/lib/domain/store";
import type { Seat } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

function position(index: number, count: number, shape: "round" | "rectangle") {
  if (shape === "round" || count < 3) {
    const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      left: `${50 + Math.cos(angle) * 38}%`,
      top: `${50 + Math.sin(angle) * 34}%`,
    };
  }

  const long = Math.ceil(count / 2);
  const short = count - long;
  if (index < long) {
    return { left: `${12 + (index / Math.max(long - 1, 1)) * 76}%`, top: "12%" };
  }
  const j = index - long;
  return { left: `${12 + (j / Math.max(short - 1, 1)) * 76}%`, top: "82%" };
}

function SeatChip({
  seat,
  name,
  onCycle,
}: {
  seat: Seat;
  name: string | null;
  onCycle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCycle}
      className={cn(
        "absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-center text-[11px] leading-tight ring-1",
        name
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-card text-muted-foreground ring-foreground/15",
      )}
    >
      {name ?? `Seat ${seat.index + 1}`}
    </button>
  );
}

export function SeatingPanel() {
  const guests = useStudioStore((state) => state.guests);
  const table = useStudioStore((state) => state.table);
  const setSeats = useStudioStore((state) => state.setSeats);
  const setShape = useStudioStore((state) => state.setTableShape);
  const assign = useStudioStore((state) => state.assignSeat);
  const loadSample = useStudioStore((state) => state.loadSample);
  const issues = seatingIssues(table.seats, guests);
  const names = new Map(guests.map((guest) => [guest.id, guest.name]));

  useEffect(() => {
    if (guests.length > 0 && table.seats.length === 0) {
      setSeats(guests.map((_, index) => ({ index, guestId: null })));
    }
  }, [guests, table.seats.length, setSeats]);

  const cycle = (index: number) => {
    const current = table.seats.find((seat) => seat.index === index)?.guestId ?? null;
    const ids = [null, ...guests.map((guest) => guest.id)];
    const next = ids[(ids.indexOf(current) + 1) % ids.length] ?? null;
    assign(index, next);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Seating
          </p>
          <h2 className="font-display mt-2 text-4xl leading-none">Who sits where.</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={table.shape === "round" ? "default" : "outline"}
            size="sm"
            onClick={() => setShape("round")}
          >
            Round
          </Button>
          <Button
            variant={table.shape === "rectangle" ? "default" : "outline"}
            size="sm"
            onClick={() => setShape("rectangle")}
          >
            Rectangle
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSeats(autoSeat(guests, table.shape))}
          >
            Auto-seat
          </Button>
        </div>
      </header>

      {guests.length === 0 ? (
        <EmptyState
          kicker="No politics yet"
          title="Seating needs people."
          body="Add guests first, or load the sample Saturday — Maya asked not to sit with Tom."
          actionLabel="Load the sample Saturday"
          onAction={loadSample}
        />
      ) : (
        <>
          <div className="relative mx-auto aspect-[4/3] w-full max-w-xl">
            <div
              className={cn(
                "absolute inset-[18%] bg-[var(--table)] shadow-[inset_0_0_0_1px_rgba(40,28,18,0.12)]",
                table.shape === "round" ? "rounded-full" : "rounded-[28px]",
              )}
            />
            <p className="font-display absolute inset-0 flex items-center justify-center text-2xl text-[var(--ink-soft)]">
              The table
            </p>
            {(table.seats.length
              ? table.seats
              : guests.map((_, index) => ({ index, guestId: null }))
            ).map((seat) => (
              <div
                key={seat.index}
                className="absolute"
                style={position(seat.index, Math.max(table.seats.length, guests.length), table.shape)}
              >
                <SeatChip
                  seat={seat}
                  name={seat.guestId ? names.get(seat.guestId) ?? null : null}
                  onCycle={() => cycle(seat.index)}
                />
              </div>
            ))}
          </div>
          {issues.length > 0 ? (
            <ul className="space-y-1 text-sm text-destructive">
              {issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No seating vetoes are being broken.
            </p>
          )}
        </>
      )}
    </div>
  );
}
