import { AlertCircle, CheckCircle, Info, XCircle, X } from "lucide-react";
import { cn } from "../../utils/cn";

const tones = {
  info: {
    bg: "bg-brand-50/40 border-brand-100/60 dark:bg-brand-500/5 dark:border-brand-500/10",
    text: "text-brand-850 dark:text-brand-300",
    icon: Info,
  },
  success: {
    bg: "bg-emerald-50/40 border-emerald-100/60 dark:bg-emerald-500/5 dark:border-emerald-500/10",
    text: "text-emerald-800 dark:text-emerald-300",
    icon: CheckCircle,
  },
  warning: {
    bg: "bg-amber-50/40 border-amber-100/60 dark:bg-amber-500/5 dark:border-amber-500/10",
    text: "text-amber-800 dark:text-amber-300",
    icon: AlertCircle,
  },
  error: {
    bg: "bg-rose-50/40 border-rose-100/60 dark:bg-rose-500/5 dark:border-rose-500/10",
    text: "text-rose-800 dark:text-rose-300",
    icon: XCircle,
  },
};

export function Alert({ tone = "info", title, children, className, onClose }) {
  const current = tones[tone] || tones.info;
  const Icon = current.icon;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-4 transition-all duration-200",
        current.bg,
        current.text,
        className
      )}
      role="alert"
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        {title && <h5 className="font-bold mb-1 leading-snug">{title}</h5>}
        <div className="opacity-90">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all self-start"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
