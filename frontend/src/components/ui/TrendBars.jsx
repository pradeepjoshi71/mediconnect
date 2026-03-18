export function TrendBars({ data, valueKey = "count", labelKey = "label", formatter }) {
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-3">
        {data.map((item) => {
          const value = Number(item[valueKey] || 0);
          const height = Math.max(16, (value / maxValue) * 180);

          return (
            <div key={item[labelKey]} className="flex flex-col items-center gap-2">
              <div className="flex h-48 items-end">
                <div
                  className="w-9 rounded-t-2xl bg-gradient-to-b from-brand-500 to-tealish-500 shadow-soft"
                  style={{ height }}
                />
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {item[labelKey]}
              </div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {formatter ? formatter(value) : value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
