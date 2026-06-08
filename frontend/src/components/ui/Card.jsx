import { cn } from "../../utils/cn";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/50 bg-white/85 shadow-premium backdrop-blur-md transition-all duration-300",
        "dark:border-neutral-200/10 dark:bg-neutral-100/70 dark:shadow-none hover:shadow-premium-glow dark:hover:border-neutral-200/20",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("p-6 pb-3 flex flex-col gap-1.5", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn(
        "text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-xs font-medium text-slate-400 dark:text-neutral-400 leading-relaxed", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-6 pt-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn("p-6 pt-3 border-t border-slate-100/80 dark:border-neutral-200/10 flex items-center justify-end gap-3", className)} {...props} />;
}
