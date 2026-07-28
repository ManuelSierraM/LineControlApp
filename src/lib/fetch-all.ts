import { supabase } from "@/integrations/supabase/client";

/**
 * Trae TODOS los registros de una tabla paginando en bloques (PostgREST
 * limita por defecto a 1000 filas por request). Necesario para vistas
 * "maestro" que muestran cargas masivas de más de 1000 registros.
 */
export async function fetchAll<T = any>(
  table: string,
  opts: {
    columns?: string;
    orderBy?: { column: string; ascending?: boolean };
    pageSize?: number;
    maxRows?: number;
    /** Filtros de igualdad opcionales, p. ej. { user_id: "..." } */
    eq?: Record<string, any>;
  } = {},
): Promise<T[]> {
  const columns = opts.columns ?? "*";
  const pageSize = opts.pageSize ?? 1000;
  const maxRows = opts.maxRows ?? 100000;
  const all: T[] = [];
  let from = 0;
  while (from < maxRows) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    let q = (supabase.from(table as any) as any).select(columns);
    if (opts.orderBy) q = q.order(opts.orderBy.column, { ascending: opts.orderBy.ascending ?? false });
    // Desempate estable por id para evitar que range() repita/omita filas
    // cuando la columna de orden tiene valores duplicados (cargas masivas
    // suelen compartir created_at exacto).
    q = q.order("id", { ascending: true });
    q = q.range(from, to);
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as T[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
