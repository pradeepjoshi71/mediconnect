import { Card, CardContent } from "./Card";

export function StatCard({ icon: Icon, label, value, helper, accent = "brand" }) {
  const tone =
    accent === "teal"
      ? "bg-tealish-50 text-tealish-700 dark:bg-tealish-500/15 dark:text-tealish-200"
      : accent === "amber"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
        : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200";

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {label}
            </div>
            <div className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              {value}
            </div>
          </div>
          <div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {helper ? <div className="text-sm text-slate-500 dark:text-slate-400">{helper}</div> : null}
      </CardContent>
    </Card>
  );
}
