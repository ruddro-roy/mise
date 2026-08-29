"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LiveStatus } from "@/hooks/use-live-party";
import { formatDate, formatTime, money } from "@/lib/domain/format";
import { analyzeMenu } from "@/lib/domain/planner";
import { useStudioStore } from "@/lib/domain/store";
import { partyPath } from "@/lib/live/api";

type StudioHeaderProps = {
  native: boolean;
  toolCount: number;
  live: { partyId: string | null; status: LiveStatus };
  onOpenAgent: () => void;
};

export function StudioHeader({
  native,
  toolCount,
  live,
  onOpenAgent,
}: StudioHeaderProps) {
  const brief = useStudioStore((state) => state.brief);
  const dishes = useStudioStore((state) => state.dishes);
  const guests = useStudioStore((state) => state.guests);
  const locked = useStudioStore((state) => state.menuLocked);
  const sent = useStudioStore((state) => state.invitesSent);
  const loadSample = useStudioStore((state) => state.loadSample);
  const reset = useStudioStore((state) => state.reset);
  const analysis = analyzeMenu(dishes, guests, brief.budgetUsd);

  const copyLink = async () => {
    if (!live.partyId) return;
    const url = new URL(partyPath(live.partyId), window.location.origin).toString();
    await navigator.clipboard.writeText(url);
  };

  return (
    <header className="flex flex-col gap-4 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex items-start gap-4">
        <div>
          <p className="font-display text-3xl leading-none">Mise</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A live table you share with ChatGPT
          </p>
        </div>
        <div className="hidden pt-1 sm:block">
          <p className="font-display text-lg leading-none">
            {brief.title || "Untitled dinner"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(brief.date)} · {formatTime(brief.startTime)}
            {brief.budgetUsd != null
              ? ` · ${money(analysis.estimatedCost)} of ${money(brief.budgetUsd)}`
              : dishes.length
                ? ` · ${money(analysis.estimatedCost)}`
                : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={live.status === "live" ? "default" : "secondary"}>
          {live.status === "live"
            ? `Live · ${live.partyId}`
            : live.status === "connecting"
              ? "Connecting"
              : "Local only"}
        </Badge>
        <Badge variant={native ? "default" : "secondary"}>
          {native ? "Native WebMCP" : "WebMCP polyfill"} · {toolCount}
        </Badge>
        {locked ? <Badge>Menu locked</Badge> : null}
        {sent ? <Badge variant="outline">Invites sent</Badge> : null}
        <Button variant="outline" size="sm" onClick={loadSample}>
          Sample Saturday
        </Button>
        <Button variant="outline" size="sm" disabled={!live.partyId} onClick={() => void copyLink()}>
          Copy live link
        </Button>
        <Button variant="ghost" size="sm" onClick={reset}>
          Clear
        </Button>
        <Button className="lg:hidden" size="sm" onClick={onOpenAgent}>
          Sous-chef
        </Button>
      </div>
    </header>
  );
}
