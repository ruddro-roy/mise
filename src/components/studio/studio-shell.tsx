"use client";

import { useState } from "react";
import { AgentDesk } from "@/components/studio/agent-desk";
import { ApprovalDialog } from "@/components/studio/approval-dialog";
import { BriefPanel } from "@/components/studio/brief-panel";
import { GuestsPanel } from "@/components/studio/guests-panel";
import { MarketPanel } from "@/components/studio/market-panel";
import { MenuPanel } from "@/components/studio/menu-panel";
import { PanelNav } from "@/components/studio/panel-nav";
import { RunPanel } from "@/components/studio/run-panel";
import { SeatingPanel } from "@/components/studio/seating-panel";
import { StudioHeader } from "@/components/studio/studio-header";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLiveParty } from "@/hooks/use-live-party";
import { useWebMcpTools } from "@/hooks/use-webmcp-tools";
import { useStudioStore } from "@/lib/domain/store";

function ActivePanel() {
  const panel = useStudioStore((state) => state.panel);
  switch (panel) {
    case "guests":
      return <GuestsPanel />;
    case "menu":
      return <MenuPanel />;
    case "seating":
      return <SeatingPanel />;
    case "market":
      return <MarketPanel />;
    case "run":
      return <RunPanel />;
    default:
      return <BriefPanel />;
  }
}

export function StudioShell() {
  const { ctx, native, tools } = useWebMcpTools();
  const live = useLiveParty();
  const [agentOpen, setAgentOpen] = useState(false);
  const hydrated = useStudioStore((state) => state.hydrated);

  if (!hydrated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="font-display text-2xl">Opening a live table…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <StudioHeader
        native={native}
        toolCount={tools.length}
        live={live}
        onOpenAgent={() => setAgentOpen(true)}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <PanelNav />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <ActivePanel />
        </main>
        <div className="hidden w-[380px] shrink-0 border-l border-border lg:block">
          <div className="sticky top-0 h-[calc(100svh-73px)]">
            <AgentDesk ctx={ctx} native={native} tools={tools} />
          </div>
        </div>
      </div>

      <Sheet open={agentOpen} onOpenChange={setAgentOpen}>
        <SheetContent side="bottom" className="h-[85svh] w-full sm:max-w-none">
          <SheetHeader className="sr-only">
            <SheetTitle>Sous-chef</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <AgentDesk ctx={ctx} native={native} tools={tools} />
          </div>
        </SheetContent>
      </Sheet>
      <ApprovalDialog />
    </div>
  );
}
