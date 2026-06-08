import { Card, CardHeader, CardTitle, CardContent } from "./Card";
import { cn } from "../../utils/cn";

export function ChartContainer({
  title = "Performance Analytics",
  subtitle,
  children,
  className,
  headerActions,
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/60">
        <div>
          <CardTitle>{title}</CardTitle>
          {subtitle && (
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </CardHeader>

      <CardContent className="pt-6 h-64 flex flex-col justify-end relative">
        {children ? (
          children
        ) : (
          /* Grid Mockup lines if empty */
          <div className="absolute inset-x-6 top-6 bottom-6 flex flex-col justify-between pointer-events-none">
            <div className="border-b border-dashed border-slate-100 dark:border-slate-800/60 w-full h-[1px]" />
            <div className="border-b border-dashed border-slate-100 dark:border-slate-800/60 w-full h-[1px]" />
            <div className="border-b border-dashed border-slate-100 dark:border-slate-800/60 w-full h-[1px]" />
            <div className="border-b border-dashed border-slate-100 dark:border-slate-800/60 w-full h-[1px]" />
            <div className="w-full h-[1px]" />
          </div>
        )}
        
        {!children && (
          /* Mock Visual representation of charts */
          <div className="flex items-end justify-between h-40 gap-3 px-6 z-10">
            <div className="bg-brand-500/10 hover:bg-brand-500/20 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 transition-all rounded-t-lg w-full h-[30%] relative group">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">30%</span>
            </div>
            <div className="bg-brand-500/10 hover:bg-brand-500/20 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 transition-all rounded-t-lg w-full h-[45%] relative group">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">45%</span>
            </div>
            <div className="bg-brand-500/10 hover:bg-brand-500/20 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 transition-all rounded-t-lg w-full h-[35%] relative group">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">35%</span>
            </div>
            <div className="bg-brand-500/10 hover:bg-brand-500/20 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 transition-all rounded-t-lg w-full h-[65%] relative group">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">65%</span>
            </div>
            <div className="bg-brand-500/10 hover:bg-brand-500/20 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 transition-all rounded-t-lg w-full h-[85%] relative group">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">85%</span>
            </div>
            <div className="bg-brand-500/10 hover:bg-brand-500/20 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 transition-all rounded-t-lg w-full h-[55%] relative group">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">55%</span>
            </div>
            <div className="bg-brand-500/10 hover:bg-brand-500/20 dark:bg-brand-500/20 dark:hover:bg-brand-500/30 transition-all rounded-t-lg w-full h-[90%] relative group">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">90%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
