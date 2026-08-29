import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { StudioShell } from "@/components/studio/studio-shell";

export function App() {
  return (
    <TooltipProvider>
      <StudioShell />
      <Toaster />
    </TooltipProvider>
  );
}
