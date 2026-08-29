"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/studio/empty-state";
import { money } from "@/lib/domain/format";
import { buildShoppingList } from "@/lib/domain/planner";
import { useStudioStore } from "@/lib/domain/store";
import { Button } from "@/components/ui/button";

export function MarketPanel() {
  const market = useStudioStore((state) => state.market);
  const dishes = useStudioStore((state) => state.dishes);
  const toggle = useStudioStore((state) => state.toggleMarket);
  const setMarket = useStudioStore((state) => state.setMarket);
  const remaining = market.filter((item) => !item.checked);
  const remainingCost = remaining.reduce((sum, item) => sum + item.estimatedCost, 0);
  const aisles = [...new Set(market.map((item) => item.aisle))];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Market
          </p>
          <h2 className="font-display mt-2 text-4xl leading-none">What to buy.</h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm tabular-nums text-muted-foreground">
            {remaining.length} left · {money(remainingCost)}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMarket(buildShoppingList(dishes))}
            disabled={dishes.length === 0}
          >
            Rebuild from menu
          </Button>
        </div>
      </header>

      {market.length === 0 ? (
        <EmptyState
          kicker="Empty basket"
          title="The list is still imaginary."
          body="Once there is a menu, rebuild the market run. Pantry oil and salt stay home."
        />
      ) : (
        <div className="space-y-6">
          {aisles.map((aisle) => (
            <section key={aisle}>
              <h3 className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                {aisle}
              </h3>
              <ul className="mt-2 divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
                {market
                  .filter((item) => item.aisle === aisle)
                  .map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={(value) => toggle(item.id, Boolean(value))}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={item.checked ? "text-muted-foreground line-through" : ""}>
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.qty} {item.unit}
                          {item.forDishes.length ? ` · ${item.forDishes.join(", ")}` : ""}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {money(item.estimatedCost)}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
