"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/studio/empty-state";
import { createId } from "@/lib/domain/ids";
import { useStudioStore } from "@/lib/domain/store";
import type { Diet, Guest } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const DIETS: Diet[] = ["omnivore", "vegetarian", "vegan", "pescatarian"];

function GuestCard({ guest }: { guest: Guest }) {
  const upsert = useStudioStore((state) => state.upsertGuest);
  const remove = useStudioStore((state) => state.removeGuest);
  const guests = useStudioStore((state) => state.guests);
  const lastTouched = useStudioStore((state) => state.lastTouched);
  const hot = lastTouched?.kind === "guest" && lastTouched.id === guest.id;

  return (
    <article
      className={cn(
        "rounded-xl bg-card p-4 ring-1 ring-foreground/10",
        hot && "ring-primary/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Input
          value={guest.name}
          onChange={(event) => upsert({ ...guest, name: event.target.value })}
          className="h-8 border-transparent bg-transparent px-0 text-base font-medium shadow-none"
        />
        <Button variant="ghost" size="xs" onClick={() => remove(guest.id)}>
          Remove
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {DIETS.map((diet) => (
          <button
            key={diet}
            type="button"
            onClick={() => upsert({ ...guest, diet })}
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] capitalize",
              guest.diet === diet
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {diet}
          </button>
        ))}
      </div>
      <Input
        className="mt-3"
        value={guest.allergens.join(", ")}
        placeholder="Allergens: nuts, gluten"
        onChange={(event) =>
          upsert({
            ...guest,
            allergens: event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          })
        }
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {guest.avoidSeatWith.length
          ? `Away from ${guest.avoidSeatWith
              .map((id) => guests.find((item) => item.id === id)?.name)
              .filter(Boolean)
              .join(", ")}`
          : "No seating vetoes"}
        {guest.preferSeatWith.length
          ? ` · With ${guest.preferSeatWith
              .map((id) => guests.find((item) => item.id === id)?.name)
              .filter(Boolean)
              .join(", ")}`
          : ""}
      </p>
    </article>
  );
}

export function GuestsPanel() {
  const guests = useStudioStore((state) => state.guests);
  const upsert = useStudioStore((state) => state.upsertGuest);
  const loadSample = useStudioStore((state) => state.loadSample);
  const [name, setName] = useState("");

  const add = () => {
    if (!name.trim()) return;
    upsert({
      id: createId("guest"),
      name: name.trim(),
      diet: "omnivore",
      allergens: [],
      avoidSeatWith: [],
      preferSeatWith: [],
      rsvp: "yes",
      notes: "",
    });
    setName("");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            Guests
          </p>
          <h2 className="font-display mt-2 text-4xl leading-none">Who is coming.</h2>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Add a name"
          />
          <Button type="submit">Add</Button>
        </form>
      </header>

      {guests.length === 0 ? (
        <EmptyState
          kicker="Empty chairs"
          title="No one at the table yet."
          body="Add people by hand, or ask the sous-chef for a Saturday of eight with diets and one nut allergy."
          actionLabel="Load the sample Saturday"
          onAction={loadSample}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {guests.map((guest) => (
            <GuestCard key={guest.id} guest={guest} />
          ))}
        </div>
      )}
    </div>
  );
}
