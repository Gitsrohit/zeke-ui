"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Accessible table caption (visually hidden). */
  caption: string;
  /** Server-driven mode: sorting and pagination are controlled by the parent. */
  manual?: { total: number; page: number; pageSize: number; onPageChange: (page: number) => void };
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  enableSelection?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  toolbar?: ReactNode;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: ReactNode;
  pageSize?: number;
  enableColumnVisibility?: boolean;
  initialColumnVisibility?: VisibilityState;
  dense?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  caption,
  manual,
  sorting: controlledSorting,
  onSortingChange,
  enableSelection,
  bulkActions,
  toolbar,
  onRowClick,
  loading,
  empty,
  pageSize = 25,
  enableColumnVisibility = true,
  initialColumnVisibility,
  dense,
  className,
}: DataTableProps<T>) {
  const [localSorting, setLocalSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility ?? {});
  const sorting = controlledSorting ?? localSorting;

  const selectionColumn: ColumnDef<T, unknown> = {
    id: "__select",
    enableSorting: false,
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all rows on this page"
        checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(v === true)} onClick={(e) => e.stopPropagation()} />
    ),
    meta: { className: "w-8" },
  };

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoisable functions by design.
  const table = useReactTable({
    data,
    columns: enableSelection ? [selectionColumn, ...columns] : columns,
    getRowId,
    state: { sorting, rowSelection, columnVisibility, ...(manual ? { pagination: { pageIndex: manual.page - 1, pageSize: manual.pageSize } } : {}) },
    onSortingChange: onSortingChange ?? setLocalSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manual ? undefined : getSortedRowModel(),
    getPaginationRowModel: manual ? undefined : getPaginationRowModel(),
    manualSorting: Boolean(manual),
    manualPagination: Boolean(manual),
    pageCount: manual ? Math.max(1, Math.ceil(manual.total / manual.pageSize)) : undefined,
    initialState: { pagination: { pageSize } },
    enableRowSelection: Boolean(enableSelection),
  });

  const rows = table.getRowModel().rows;
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const total = manual ? manual.total : data.length;
  const page = manual ? manual.page : table.getState().pagination.pageIndex + 1;
  const size = manual ? manual.pageSize : table.getState().pagination.pageSize;
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const goTo = (p: number) => (manual ? manual.onPageChange(p) : table.setPageIndex(p - 1));
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());

  return (
    <div className={cn("rounded-lg border border-border bg-surface", className)}>
      {(toolbar || enableColumnVisibility || (enableSelection && selected.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          {enableSelection && selected.length > 0 && bulkActions ? (
            <div className="flex flex-wrap items-center gap-2" role="region" aria-label="Bulk actions">
              <span className="font-mono text-xs font-semibold text-primary">{selected.length} selected</span>
              {bulkActions(selected, () => setRowSelection({}))}
              <Button variant="ghost" size="xs" onClick={() => setRowSelection({})}>
                Clear
              </Button>
            </div>
          ) : (
            toolbar
          )}
          {enableColumnVisibility && hideable.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-auto">
                  <Columns3 /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-label">Visible columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideable.map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(v === true)} onSelect={(e) => e.preventDefault()}>
                    {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-[13px]" aria-busy={loading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const dir = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta as { className?: string; align?: "right" | "center" } | undefined;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : canSort ? "none" : undefined}
                      className={cn("text-label border-b border-border px-3 pt-3 pb-2.5 text-left whitespace-nowrap", meta?.align === "right" && "text-right", meta?.align === "center" && "text-center", meta?.className)}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button type="button" onClick={header.column.getToggleSortingHandler()} className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", dir && "text-primary")}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : dir === "desc" ? <ArrowDown className="size-3" aria-hidden /> : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && rows.length === 0
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    {table.getVisibleLeafColumns().map((c) => (
                      <td key={c.id} className="border-b border-border px-3 py-3">
                        <div className="skeleton h-3.5 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row.original);
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn("transition-colors last:[&>td]:border-b-0 data-[state=selected]:bg-violet-tint/50", onRowClick && "cursor-pointer outline-none hover:bg-surface-muted focus-visible:bg-violet-tint/40", loading && "opacity-60")}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as { className?: string; align?: "right" | "center" } | undefined;
                      return (
                        <td key={cell.id} className={cn("border-b border-border px-3 align-middle", dense ? "py-2" : "py-3", meta?.align === "right" && "text-right", meta?.align === "center" && "text-center", meta?.className)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (empty ?? <p className="px-4 py-10 text-center text-[13px] text-foreground-faint">No results.</p>)}
      </div>
      {total > size && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-foreground-muted">
          <span className="font-mono">
            {from}–{to} of {total}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon-sm" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="px-1 font-mono">
              {page} / {pages}
            </span>
            <Button variant="outline" size="icon-sm" onClick={() => goTo(page + 1)} disabled={page >= pages} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
