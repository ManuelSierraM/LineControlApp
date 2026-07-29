import { useEffect, useMemo, useState } from "react";
import { Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  accessor?: (row: T) => string | number | null | undefined;
}

interface Props<T> {
  title: string;
  rows: T[];
  columns: Column<T>[];
  searchKeys?: (keyof T)[];
  emptyText?: string;
}

export function DataTable<T extends Record<string, any>>({
  title, rows, columns, searchKeys, emptyText = "No se encontraron registros",
}: Props<T>) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q) return rows;
    const ql = q.toLowerCase();
    return rows.filter((r) => {
      const fields = searchKeys ?? (Object.keys(r) as (keyof T)[]);
      return fields.some((k) => String(r[k] ?? "").toLowerCase().includes(ql));
    });
  }, [q, rows, searchKeys]);

  const exportCsv = () => {
    const header = columns.map((c) => `"${c.header}"`).join(",");
    const lines = filtered.map((r) =>
      columns.map((c) => {
        const v = c.accessor ? c.accessor(r) : (r as any)[c.key];
        return `"${String(v ?? "").replaceAll('"', '""')}"`;
      }).join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title.toLowerCase().replace(/\s+/g, "_")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{filtered.length} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-64 pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className="text-xs uppercase tracking-wider text-muted-foreground">
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r, i) => (
                <TableRow key={(r as any).id ?? i}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>
                      {c.render ? c.render(r) : (c.accessor ? c.accessor(r) : (r as any)[c.key]) ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
