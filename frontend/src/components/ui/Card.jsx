import { cn } from "../../utils/cn";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/70 bg-white shadow-card",
        "dark:border-slate-800/60 dark:bg-slate-950",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("p-6 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }) {
  return (
    <p
      className={cn("mt-1 text-sm text-slate-600 dark:text-slate-400", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-6 pt-3", className)} {...props} />;
}

