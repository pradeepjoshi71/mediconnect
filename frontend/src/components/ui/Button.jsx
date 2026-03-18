import { cn } from "../../utils/cn";

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  ...props
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-base",
        variant === "primary" &&
          "bg-gradient-to-r from-brand-600 to-tealish-600 text-white shadow-soft hover:scale-[1.01] hover:from-brand-700 hover:to-tealish-700 active:scale-[0.99]",
        variant === "secondary" &&
          "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
        variant === "ghost" &&
          "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900/60",
        variant === "outline" &&
          "border border-slate-200 bg-white text-slate-800 hover:border-brand-200 hover:bg-brand-50/60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900/40",
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-slate-400/40 dark:border-t-slate-900" />
      ) : null}
      {props.children}
    </button>
  );
}
