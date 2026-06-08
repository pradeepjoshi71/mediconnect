import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "./Card";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";
import { Skeleton } from "./Skeleton";
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { cn } from "../../utils/cn";

export function PaginatedTable({
  columns,
  rows = [],
  pageSize = 6,
  emptyState,
  loading = false,
  searchableKeys = [], // array of object keys to search in (e.g. ["fullName", "email"])
  searchPlaceholder = "Search records...",
  filterKey, // object key to filter by (e.g. "status")
  filterOptions = [], // e.g. [{ value: "all", label: "All Statuses" }, { value: "pending", label: "Pending" }]
}) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" }); // direction: 'asc' | 'desc'

  // Reset page when search/filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterValue]);

  // Handle column sort trigger
  const handleSort = (key, sortable) => {
    if (!sortable) return;
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // 1. Filter rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Apply search query
      const matchesSearch =
        searchQuery === "" ||
        searchableKeys.some((key) => {
          const val = row[key];
          if (!val) return false;
          return String(val).toLowerCase().includes(searchQuery.toLowerCase());
        });

      // Apply dropdown filter
      const matchesFilter =
        filterValue === "all" ||
        !filterKey ||
        String(row[filterKey]).toLowerCase() === filterValue.toLowerCase();

      return matchesSearch && matchesFilter;
    });
  }, [rows, searchQuery, filterValue, filterKey, searchableKeys]);

  // 2. Sort rows
  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return filteredRows;
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Handle simple nested properties if needed, or extract values
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredRows, sortConfig]);

  // 3. Paginate rows
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const startIndex = (page - 1) * pageSize;
  const visibleRows = sortedRows.slice(startIndex, startIndex + pageSize);

  return (
    <Card className="overflow-hidden border border-slate-200/40 bg-white/80 dark:border-neutral-200/10 dark:bg-neutral-100/70 shadow-premium">
      {/* Search and filter bar */}
      {(searchableKeys.length > 0 || filterOptions.length > 0) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-5 border-b border-slate-100/60 dark:border-neutral-200/10 bg-white/20 dark:bg-neutral-100/20">
          {searchableKeys.length > 0 && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-xs"
              />
            </div>
          )}
          {filterOptions.length > 0 && filterKey && (
            <div className="w-full sm:w-auto">
              <Select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="h-9 text-xs px-3"
                options={filterOptions}
              />
            </div>
          )}
        </div>
      )}

      <CardContent className="p-0">
        {loading ? (
          /* Table Loader Skeleton state */
          <div className="p-5 space-y-4">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ) : visibleRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/60 text-slate-400 dark:border-neutral-200/10 bg-slate-50/40 dark:bg-neutral-100/25">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      onClick={() => handleSort(column.key, column.sortable)}
                      className={cn(
                        "px-5 py-3.5 font-bold text-[10px] uppercase tracking-wider select-none text-slate-500 dark:text-slate-400",
                        column.sortable && "cursor-pointer hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{column.label}</span>
                        {column.sortable && (
                          <span className="text-slate-400 dark:text-slate-600">
                            {sortConfig.key === column.key ? (
                              sortConfig.direction === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-brand-500" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-brand-500" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50 dark:divide-neutral-200/10">
                {visibleRows.map((row, rowIndex) => (
                  <tr
                    key={row.id || rowIndex}
                    className="hover:bg-slate-50/40 dark:hover:bg-neutral-100/20 transition-colors duration-200"
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-5 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {column.render ? column.render(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">{emptyState}</div>
        )}

        {/* Paginator footer controls */}
        {!loading && sortedRows.length > pageSize && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100/60 dark:border-neutral-200/10">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, sortedRows.length)} of {sortedRows.length} entries
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Prev
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
        )}
      </CardContent>
    </Card>
  );
}
