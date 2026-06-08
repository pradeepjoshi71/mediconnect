import { FolderOpen } from "lucide-react";
import { Card, CardContent } from "./Card";

export function EmptyState({ title, description, icon: Icon = FolderOpen }) {
  return (
    <Card className="border-dashed border-2 border-slate-200/60 dark:border-slate-800 bg-transparent shadow-none hover:shadow-none">
      <CardContent className="py-14 text-center flex flex-col items-center justify-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 mb-4">
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">{description}</div>
      </CardContent>
    </Card>
  );
}
