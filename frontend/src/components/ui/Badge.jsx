import { cn } from "../../utils/cn";

const toneClasses = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200",
  teal: "bg-tealish-50 text-tealish-700 dark:bg-tealish-500/15 dark:text-tealish-200",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200",
};

export function Badge({ children, tone = "slate", className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide",
        toneClasses[tone] || toneClasses.slate,
        className
      )}
    >
      {children}
    </span>
  );
}
