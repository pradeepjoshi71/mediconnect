import { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const Input = forwardRef(({ className, error, ...props }, ref) => {
  return (
    <div className="w-full flex flex-col items-start">
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-slate-200 bg-white/60 px-4 text-sm text-slate-900 transition-all duration-200",
          "placeholder:text-slate-400 focus:bg-white focus:border-brand-500/80",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/10",
          "disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed",
          "dark:border-neutral-200/10 dark:bg-neutral-100/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-neutral-50 dark:focus:border-brand-500/80",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/10 dark:border-red-500 dark:focus:border-red-500",
          className
        )}
        {...props}
      />
      {error && (
        <span className="mt-1 text-xxs font-bold text-red-500 block pl-1 animate-fade-in">
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = "Input";

