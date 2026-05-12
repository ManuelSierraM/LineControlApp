import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Info, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/alertas")({ component: AlertasPage });

function AlertasPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["alertas-all"],
    queryFn: async () => {
      const { data } = await supabase.from("alertas").select("*").order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  const resolver = async (id: string) => {
    await supabase.from("alertas").update({ resuelta: true }).eq("id", id);
    toast.success("Alerta marcada como resuelta");
    qc.invalidateQueries({ queryKey: ["alertas-all"] });
  };

  const grupos = (data ?? []).reduce<Record<string, typeof data>>((acc, a) => {
    const k = a.tipo;
    (acc[k] ||= [] as any).push(a);
    return acc;
  }, {} as any);

  return (
    <div>
      <PageHeader title="Alertas" subtitle="Inconsistencias y oportunidades detectadas" />
      <div className="space-y-6 p-6">
        {Object.keys(grupos).length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            No hay alertas. Carga archivos para generarlas automáticamente.
          </div>
        )}
        {Object.entries(grupos).map(([tipo, items]) => (
          <div key={tipo} className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold capitalize">{tipo.replace("_", " ")}</h3>
              <span className="text-xs text-muted-foreground">{items!.length} alertas</span>
            </div>
            <div className="divide-y divide-border">
              {items!.map((a) => {
                const Icon = a.severidad === "alta" ? AlertCircle : a.severidad === "media" ? AlertTriangle : Info;
                const tone = a.severidad === "alta" ? "text-destructive bg-destructive/10" : a.severidad === "media" ? "text-warning-foreground bg-warning/15" : "text-info bg-info/10";
                return (
                  <div key={a.id} className="flex items-center gap-4 p-4">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${a.resuelta ? "line-through text-muted-foreground" : ""}`}>{a.mensaje}</p>
                      {a.detalle && <p className="text-xs text-muted-foreground">{a.detalle}</p>}
                    </div>
                    {!a.resuelta && (
                      <Button size="sm" variant="outline" onClick={() => resolver(a.id)}>
                        <Check className="mr-1 h-3 w-3" /> Resolver
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
