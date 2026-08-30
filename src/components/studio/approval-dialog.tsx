"use client";

import { useRef } from "react";
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
  const resolveApproval = useStudioStore((state) => state.resolveApproval);
  const settledId = useRef<string | null>(null);
  if (pending && settledId.current !== pending.id) {
    settledId.current = null;
  }

  const settle = (ok: boolean) => {
    const current = useStudioStore.getState().pendingApproval;
    if (!current || settledId.current === current.id) return;
    settledId.current = current.id;
    resolveApproval(ok);
  };

  return (
    <Dialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open) settle(false);
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
          <Button variant="outline" onClick={() => settle(false)}>
            Not yet
          </Button>
          <Button onClick={() => settle(true)}>{pending?.confirmLabel ?? "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
