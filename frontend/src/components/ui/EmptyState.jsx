import { Card, CardContent } from "./Card";

export function EmptyState({ title, description }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center">
        <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</div>
      </CardContent>
    </Card>
  );
}
