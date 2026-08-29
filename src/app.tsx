import { TooltipProvider } from "@/components/ui/tooltip";
import { StudioShell } from "@/components/studio/studio-shell";

export function App() {
  return (
    <TooltipProvider>
      <StudioShell />
    </TooltipProvider>
  );
}
