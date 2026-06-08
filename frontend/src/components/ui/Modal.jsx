import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

export function Modal({ open, onClose, title, children, className }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-300 animate-fade-in"
        onClick={() => onClose?.()}
      />
      
      {/* Modal Dialog */}
      <div
        className={cn(
          "relative w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-premium backdrop-blur-xl transition-all duration-300 animate-slide-up",
          "dark:border-slate-800 dark:bg-slate-950/95",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800/60">
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
        <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
}
