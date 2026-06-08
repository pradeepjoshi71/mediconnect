import { cn } from "../../utils/cn";

export function Select({ className, options = [], children, ...props }) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-xl border border-slate-200 bg-white/60 px-4 text-sm text-slate-900 transition-all duration-200 cursor-pointer",
        "focus:bg-white focus:border-brand-500/80",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/10",
        "disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed",
        "dark:border-neutral-200/10 dark:bg-neutral-100/40 dark:text-slate-100 dark:focus:bg-neutral-50 dark:focus:border-brand-500/80",
        className
      )}
      {...props}
    >
      {children ? children : options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
