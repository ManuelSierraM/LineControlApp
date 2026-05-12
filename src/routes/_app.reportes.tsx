import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reportes")({ component: ReportesPage });

const REPORTES = [
  { key: "lineas", titulo: "Maestro de Líneas", desc: "Todas las líneas móviles importadas" },
  { key: "dispositivos", titulo: "Dispositivos UEM", desc: "Inventario de equipos enrolados" },
  { key: "pops", titulo: "Inventario POPS", desc: "Puntos de presencia" },
  { key: "alertas", titulo: "Alertas e Inconsistencias", desc: "Alertas detectadas en el análisis" },
] as const;

function ReportesPage() {
  const { data: counts } = useQuery({
    queryKey: ["report-counts"],
    queryFn: async () => {
      const out: Record<string, number> = {};
      for (const r of REPORTES) {
        const { count } = await supabase.from(r.key as any).select("*", { count: "exact", head: true });
        out[r.key] = count ?? 0;
      }
      return out;
    },
  });

  const exportar = async (tabla: string, titulo: string) => {
    const { data, error } = await supabase.from(tabla as any).select("*").limit(5000);
    if (error || !data || data.length === 0) { toast.error("Sin datos para exportar"); return; }
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replaceAll('"', '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${titulo.toLowerCase().replace(/\s+/g, "_")}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exportado: ${titulo}`);
  };

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Genera y descarga reportes ejecutivos" />
      <div className="grid gap-4 p-6 md:grid-cols-2">
        {REPORTES.map((r) => (
          <div key={r.key} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {(counts?.[r.key] ?? 0).toLocaleString("es-CO")} registros
              </span>
            </div>
            <h3 className="mt-4 font-semibold">{r.titulo}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
            <Button className="mt-4 w-full" variant="outline" onClick={() => exportar(r.key, r.titulo)}>
              <Download className="mr-2 h-4 w-4" /> Descargar CSV
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
