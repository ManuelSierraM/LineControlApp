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
  /** Tamaños de página disponibles (orden ascendente). */
  pageSizeOptions?: number[];
  /** Valor inicial de filas por página. Si no se indica, usa el primer valor de pageSizeOptions. */
  defaultPageSize?: number;
  /** Footer opcional para mostrar totales o resúmenes debajo de la paginación. */
  footer?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  title, rows, columns, searchKeys, emptyText = "No se encontraron registros",
  pageSizeOptions = [10, 25, 50, 100, 250, 500],
  defaultPageSize,
  footer,
}: Props<T>) {
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const ql = q.toLowerCase();
    return rows.filter((r) => {
      const fields = searchKeys ?? (Object.keys(r) as (keyof T)[]);
      return fields.some((k) => String(r[k] ?? "").toLowerCase().includes(ql));
    });
  }, [q, rows, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Al cambiar búsqueda/tamaño/dataset, la página actual puede quedar fuera de rango.
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);
  useEffect(() => { setPage(1); }, [q, pageSize]);

  const start = (page - 1) * pageSize;
  // Solo se renderizan las filas de la página actual (evita montar miles de <tr>).
  const paged = useMemo(() => filtered.slice(start, start + pageSize), [filtered, start, pageSize]);


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
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((r, i) => (
                <TableRow key={(r as any).id ?? start + i}>
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

      {footer && (
        <div className="border-y border-border bg-muted/30 p-4">
          {footer}
        </div>
      )}

      <nav
        aria-label="Paginación de la tabla"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filas por página</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[84px]" aria-label="Filas por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {filtered.length === 0
            ? "0 de 0"
            : `${(start + 1).toLocaleString("es-CO")}–${Math.min(start + pageSize, filtered.length).toLocaleString("es-CO")} de ${filtered.length.toLocaleString("es-CO")}`}
          {" · "}Página {page.toLocaleString("es-CO")} de {totalPages.toLocaleString("es-CO")}
        </p>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Primera página"
            onClick={() => setPage(1)} disabled={page <= 1}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Página anterior"
            onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Página siguiente"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Última página"
            onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </nav>
    </div>

  );
}
