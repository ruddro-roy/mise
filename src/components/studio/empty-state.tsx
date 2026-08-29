import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  kicker: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  kicker,
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[280px] flex-col items-start justify-center border border-dashed border-border/80 bg-card/40 px-6 py-10">
      <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {kicker}
      </p>
      <h2 className="font-display mt-3 max-w-lg text-3xl leading-tight">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
      {actionLabel && onAction ? (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
