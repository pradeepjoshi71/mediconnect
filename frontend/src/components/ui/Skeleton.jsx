import { cn } from "../../utils/cn";

export function Skeleton({ className }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-slate-200/60 dark:bg-slate-800/60",
        className
      )}
    />
  );
}
