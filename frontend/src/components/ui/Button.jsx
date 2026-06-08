import { cn } from "../../utils/cn";

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-50",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.97] active:translate-y-0",
        
        // Sizes
        size === "sm" && "h-9 px-3.5 text-xs rounded-lg gap-1.5",
        size === "md" && "h-11 px-5 text-sm gap-2",
        size === "lg" && "h-12 px-6 text-base gap-2.5",
        
        // Variants
        variant === "primary" && [
          "bg-brand-600 text-white shadow-button-glow hover:bg-brand-700 hover:shadow-lg hover:-translate-y-[1px]",
          "dark:bg-brand-500 dark:hover:bg-brand-600 dark:text-white dark:font-semibold"
        ],
        
        variant === "secondary" && [
          "bg-slate-100 text-slate-900 hover:bg-slate-200 hover:-translate-y-[1px] dark:bg-neutral-800 dark:text-slate-100 dark:hover:bg-neutral-700"
        ],
        
        variant === "ghost" && [
          "bg-transparent text-slate-700 hover:bg-slate-100 hover:-translate-y-[1px] dark:text-slate-200 dark:hover:bg-neutral-900/60"
        ],
        
        variant === "outline" && [
          "border border-slate-200 bg-white/70 text-slate-800 hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-[1px]",
          "dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-slate-100 dark:hover:bg-neutral-800/80 dark:hover:border-neutral-700"
        ],
        
        variant === "destructive" && [
          "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:-translate-y-[1px]",
          "dark:bg-red-500/10 dark:text-red-400 dark:border dark:border-red-500/20 dark:hover:bg-red-500/20"
        ],
        
        className
      )}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-1 mr-1 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
