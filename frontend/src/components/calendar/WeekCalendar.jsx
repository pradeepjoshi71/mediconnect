import { addDays, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { cn } from "../../utils/cn";

export default function WeekCalendar({ anchorDate = new Date(), events = [] }) {
  const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
  const end = endOfWeek(anchorDate, { weekStartsOn: 1 });

  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-7 border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn(
              "px-3 py-3",
              isSameDay(d, new Date()) && "text-brand-700 dark:text-brand-200"
            )}
          >
            <div className="uppercase tracking-wider">{format(d, "EEE")}</div>
            <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{format(d, "d")}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dayEvents = events
            .filter((e) => isSameDay(new Date(e.starts_at), d))
            .slice(0, 6);
          return (
            <div
              key={d.toISOString()}
              className="min-h-[150px] border-r border-slate-200 p-3 last:border-r-0 dark:border-slate-800"
            >
              {dayEvents.length ? (
                <div className="space-y-2">
                  {dayEvents.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
                    >
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {format(new Date(e.starts_at), "p")}
                      </div>
                      <div className="mt-0.5 text-slate-600 dark:text-slate-400">
                        {e.doctor_name || e.patient_name || "Appointment"} • {e.status}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No events
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

