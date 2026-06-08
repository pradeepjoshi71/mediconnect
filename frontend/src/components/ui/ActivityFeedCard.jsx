import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { cn } from "../../utils/cn";

const bulletColors = {
  brand: "bg-brand-500 ring-brand-500/20",
  teal: "bg-tealish-500 ring-tealish-500/20",
  success: "bg-emerald-500 ring-emerald-500/20",
  warning: "bg-amber-500 ring-amber-500/20",
  error: "bg-rose-500 ring-rose-500/20",
  slate: "bg-slate-400 ring-slate-400/20",
};

export function ActivityFeedCard({
  title = "Recent Activity",
  items = [],
  className,
  onViewAll,
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60">
        <CardTitle>{title}</CardTitle>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            View All
          </button>
        )}
      </CardHeader>

      <CardContent className="pt-6">
        {items.length === 0 ? (
          <div className="text-center py-8 text-xs font-medium text-slate-400 dark:text-slate-500">
            No activity logged yet.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
            {items.map((item) => {
              const BulletIcon = item.icon;
              const color = bulletColors[item.tone] || bulletColors.slate;
              
              return (
                <div key={item.id} className="relative group">
                  {/* Timeline bullet dot */}
                  <div
                    className={cn(
                      "absolute -left-[20px] top-1.5 h-3 w-3 rounded-full ring-4 transition-all duration-300 group-hover:scale-110",
                      color
                    )}
                  >
                    {BulletIcon && (
                      <span className="hidden">
                        <BulletIcon className="h-3 w-3" />
                      </span>
                    )}
                  </div>

                  {/* Activity content */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    {item.timestamp && (
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap self-start sm:self-center">
                        {item.timestamp}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
