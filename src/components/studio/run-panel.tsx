"use client";

import { EmptyState } from "@/components/studio/empty-state";
import { formatClock } from "@/lib/domain/format";
import { buildRunOfShow } from "@/lib/domain/planner";
import { useStudioStore } from "@/lib/domain/store";
import { Button } from "@/components/ui/button";

export function RunPanel() {
  const timeline = useStudioStore((state) => state.timeline);
  const dishes = useStudioStore((state) => state.dishes);
  const start = useStudioStore((state) => state.brief.startTime);
  const setTimeline = useStudioStore((state) => state.setTimeline);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Run of show
          </p>
          <h2 className="font-display mt-2 text-4xl leading-none">The day, backward.</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={dishes.length === 0}
          onClick={() => setTimeline(buildRunOfShow(dishes, start, 4))}
        >
          Write a 4-hour run
        </Button>
      </header>

      {timeline.length === 0 ? (
        <EmptyState
          kicker="No clock yet"
          title="Dinner still has no spine."
          body="A run of show works back from sit-down: market, mise, the long roast, then people at the door."
        />
      ) : (
        <ol className="relative space-y-0 border-l border-border ml-3">
          {timeline.map((step) => (
            <li key={step.id} className="relative py-4 pl-6">
              <span className="absolute top-6 -left-[5px] size-2.5 rounded-full bg-primary" />
              <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                {formatClock(start, step.offsetMinutes)} · {step.owner}
              </p>
              <h3 className="font-display mt-1 text-2xl leading-none">{step.title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
