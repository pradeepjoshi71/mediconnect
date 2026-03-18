import { format } from "date-fns";
import { cn } from "../../utils/cn";

const START_HOUR = 8;
const END_HOUR = 18;

export default function SlotsCalendarPicker({ slots = [], selected, onSelect }) {
  const byTime = new Map(slots.map((iso) => [new Date(iso).toISOString(), true]));
  const rows = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    rows.push(`${String(h).padStart(2, "0")}:00`);
    rows.push(`${String(h).padStart(2, "0")}:30`);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="grid grid-cols-2 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <div>Time</div>
        <div>Availability</div>
      </div>
      <div className="max-h-[360px] overflow-auto">
        {rows.map((t) => {
          const label = t;
          // selected date is baked into ISO strings already; compare by hh:mm
          const match = slots.find((iso) => format(new Date(iso), "HH:mm") === t);
          const iso = match ? new Date(match).toISOString() : null;
          const available = iso && byTime.get(iso);
          return (
            <div
              key={t}
              className="grid grid-cols-2 items-center border-b border-slate-100 px-4 py-2 text-sm dark:border-slate-900"
            >
              <div className="font-semibold text-slate-800 dark:text-slate-200">{label}</div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!available}
                  onClick={() => available && onSelect?.(iso)}
                  className={cn(
                    "rounded-2xl px-4 py-2 text-xs font-extrabold transition",
                    available
                      ? selected === iso
                        ? "bg-brand-600 text-white shadow-soft"
                        : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/50"
                      : "cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-500"
                  )}
                >
                  {available ? (selected === iso ? "Selected" : "Select") : "Unavailable"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

