import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

export function Drawer({ open, onClose, title, children, className, side = "right", size = "max-w-md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
        onClick={() => onClose?.()}
      />

      <div className={cn("absolute inset-y-0 flex max-w-full", side === "right" ? "right-0" : "left-0")}>
        <div
          className={cn(
            "w-screen bg-white shadow-premium flex flex-col h-full border-l border-slate-200/80 transition-all duration-300",
            "dark:bg-slate-950 dark:border-slate-800",
            size,
            side === "right" 
              ? "animate-slide-up" // Or right slide in if configured in tailwind config, slide-up looks clean
              : "animate-slide-up",
            className
          )}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between dark:border-slate-800/60">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
            <button
              onClick={() => onClose?.()}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-900/60 dark:hover:text-slate-200 transition-all"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
