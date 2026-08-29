"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudioStore } from "@/lib/domain/store";

export function ApprovalDialog() {
  const pending = useStudioStore((state) => state.pendingApproval);
  const resolve = useStudioStore((state) => state.resolveApproval);

  return (
    <Dialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open && pending) resolve(false);
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{pending?.title ?? "Confirm"}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-[13px] leading-6">
            {pending?.body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => resolve(false)}>
            Not yet
          </Button>
          <Button onClick={() => resolve(true)}>{pending?.confirmLabel ?? "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
