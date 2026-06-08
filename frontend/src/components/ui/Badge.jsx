import { cn } from "../../utils/cn";

const toneClasses = {
  brand: "bg-brand-50 text-brand-700 border border-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/20",
  teal: "bg-tealish-50 text-tealish-700 border border-tealish-100 dark:bg-tealish-500/10 dark:text-tealish-300 dark:border-tealish-500/20",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  amber: "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  rose: "bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
  slate: "bg-slate-50 text-slate-600 border border-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-800",
};

export function Badge({ children, tone = "slate", className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-all",
        toneClasses[tone] || toneClasses.slate,
        className
      )}
    >
      {children}
    </span>
  );
}
