import { Card, CardContent } from "./Card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "../../utils/cn";

const accentClasses = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  teal: "bg-tealish-50 text-tealish-600 dark:bg-tealish-500/10 dark:text-tealish-400",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  trend, // e.g. { value: "12%", isPositive: true }
  description, // e.g. "vs last month"
  accent = "brand",
  className,
}) {
  const badgeColor = accentClasses[accent] || accentClasses.brand;

  return (
    <Card className={cn("overflow-hidden group hover:scale-[1.01] active:scale-[0.99]", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {label}
          </span>
          <div className={cn("grid h-10 w-10 place-items-center rounded-xl transition-all duration-300 group-hover:shadow-glow", badgeColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 flex items-baseline gap-2.5">
          <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {value}
          </span>
          
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight",
                trend.isPositive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
              )}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="h-3 w-3 shrink-0" />
              ) : (
                <ArrowDownRight className="h-3 w-3 shrink-0" />
              )}
              {trend.value}
            </span>
          )}
        </div>

        {description && (
          <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
