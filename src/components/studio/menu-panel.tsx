"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio/empty-state";
import { money } from "@/lib/domain/format";
import { analyzeMenu, dishEstimatedCost } from "@/lib/domain/planner";
import { useStudioStore } from "@/lib/domain/store";
import type { Course } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const COURSE_ORDER: Course[] = ["starter", "main", "side", "dessert", "drink"];

export function MenuPanel() {
  const dishes = useStudioStore((state) => state.dishes);
  const guests = useStudioStore((state) => state.guests);
  const budget = useStudioStore((state) => state.brief.budgetUsd);
  const locked = useStudioStore((state) => state.menuLocked);
  const remove = useStudioStore((state) => state.removeDish);
  const loadSample = useStudioStore((state) => state.loadSample);
  const analysis = analyzeMenu(dishes, guests, budget);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Menu
          </p>
          <h2 className="font-display mt-2 text-4xl leading-none">What we are cooking.</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={locked ? "default" : "outline"}>
            {locked ? "Locked" : "Open"}
          </Badge>
          <span className="tabular-nums text-muted-foreground">
            {money(analysis.estimatedCost)}
            {budget != null ? ` / ${money(budget)}` : ""}
          </span>
        </div>
      </header>

      {analysis.warnings.length > 0 ? (
        <ul className="space-y-1 rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/15">
          {analysis.warnings.map((warning) => (
            <li key={warning.code}>{warning.message}</li>
          ))}
        </ul>
      ) : null}

      {dishes.length === 0 ? (
        <EmptyState
          kicker="Blank page"
          title="The menu is still a blank page."
          body="Ask the sous-chef for an Italian Saturday that keeps nuts off the table, or load the sample party and start arguing about pasta."
          actionLabel="Load the sample Saturday"
          onAction={loadSample}
        />
      ) : (
        <div className="space-y-8">
          {COURSE_ORDER.map((course) => {
            const rows = dishes.filter((dish) => dish.course === course);
            if (!rows.length) return null;
            return (
              <section key={course}>
                <h3 className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                  {course}
                </h3>
                <div className="mt-3 grid gap-3">
                  {rows.map((dish) => (
                    <article
                      key={dish.id}
                      className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <h4 className="font-display text-2xl leading-none">{dish.name}</h4>
                          <span className="text-xs text-muted-foreground capitalize">
                            {dish.diet}
                          </span>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                          {dish.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {dish.allergens.length ? (
                            dish.allergens.map((allergen) => (
                              <Badge key={allergen} variant="outline">
                                {allergen}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary">no listed allergens</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end">
                        <p className="text-sm tabular-nums text-muted-foreground">
                          {money(dishEstimatedCost(dish))} · {dish.servings} plates
                        </p>
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={locked}
                          className={cn(locked && "opacity-40")}
                          onClick={() => remove(dish.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
