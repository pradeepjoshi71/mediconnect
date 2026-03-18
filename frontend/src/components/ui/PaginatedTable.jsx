import { useEffect, useState } from "react";
import { Card, CardContent } from "./Card";
import { Button } from "./Button";

export function PaginatedTable({ columns, rows, pageSize = 6, emptyState }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const visibleRows = rows.slice(startIndex, startIndex + pageSize);

  return (
    <Card>
      <CardContent className="space-y-4">
        {visibleRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 text-left text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                  {columns.map((column) => (
                    <th key={column.key} className="px-2 py-3 font-semibold">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIndex) => (
                  <tr
                    key={row.id || rowIndex}
                    className="border-b border-slate-100 align-top dark:border-slate-900"
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-2 py-4 text-slate-700 dark:text-slate-200">
                        {column.render ? column.render(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          emptyState
        )}

        {rows.length > pageSize ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
