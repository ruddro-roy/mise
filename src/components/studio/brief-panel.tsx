"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStudioStore } from "@/lib/domain/store";
import type { EventBrief } from "@/lib/domain/types";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <Label className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </label>
  );
}

export function BriefPanel() {
  const brief = useStudioStore((state) => state.brief);
  const patchBrief = useStudioStore((state) => state.patchBrief);

  const set =
    (key: keyof EventBrief) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      if (key === "guestCount" || key === "budgetUsd") {
        patchBrief({ [key]: value === "" ? (key === "guestCount" ? 0 : null) : Number(value) });
        return;
      }
      patchBrief({ [key]: value || (key === "date" || key === "startTime" ? null : value) });
    };

  return (
    <div className="space-y-8">
      <header className="max-w-xl">
        <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          The brief
        </p>
        <h2 className="font-display mt-2 text-4xl leading-none">Name the night.</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Constraints live here. Taste lives in the menu. Your agent can fill this from a
          sentence. You still decide what the night is for.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <Input
            value={brief.title}
            onChange={set("title")}
            placeholder="Saturday at Maya's"
          />
        </Field>
        <Field label="Cuisine">
          <Input
            value={brief.cuisine}
            onChange={set("cuisine")}
            placeholder="italian"
          />
        </Field>
        <Field label="Date">
          <Input type="date" value={brief.date ?? ""} onChange={set("date")} />
        </Field>
        <Field label="Sit-down">
          <Input type="time" value={brief.startTime ?? ""} onChange={set("startTime")} />
        </Field>
        <Field label="Headcount">
          <Input
            type="number"
            min={0}
            value={brief.guestCount || ""}
            onChange={set("guestCount")}
            placeholder="8"
          />
        </Field>
        <Field label="Budget, USD">
          <Input
            type="number"
            min={0}
            value={brief.budgetUsd ?? ""}
            onChange={set("budgetUsd")}
            placeholder="90"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Vibe">
            <Input
              value={brief.vibe}
              onChange={set("vibe")}
              placeholder="Warm, unfussy, one long conversation"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes for the table">
            <Textarea
              value={brief.notes}
              onChange={set("notes")}
              placeholder="Family style. Nobody stands to plate."
              rows={4}
            />
          </Field>
        </div>
      </div>

      <section className="max-w-2xl border-t border-border pt-8 text-sm leading-6 text-muted-foreground">
        <h3 className="font-display text-xl text-foreground">How WebMCP sits at this table</h3>
        <p className="mt-2">
          Every action the sous-chef takes is a{" "}
          <code className="font-mono text-xs">document.modelContext</code> tool, the
          same contract ChatGPT&apos;s in-app browser and Chrome with WebMCP enabled
          discover. Tools that change the menu wait if it is locked. Tools that send
          invites wait for you. View-specific read tools appear and disappear with the
          panel you have open.
        </p>
      </section>
    </div>
  );
}
