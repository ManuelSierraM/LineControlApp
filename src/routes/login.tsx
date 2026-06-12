import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";

async function signInWithMicrosoft() {
  const result = await lovable.auth.signInWithOAuth("microsoft", {
    redirect_uri: window.location.origin,
  });
  if (result.error) toast.error(result.error.message ?? "Error con Microsoft");
}

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (user) return <Navigate to="/" />;

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Bienvenido");
    navigate({ to: "/" });
  };
  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await signUp(email, password, fullName);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Cuenta creada");
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sidebar text-sidebar-primary-foreground shadow-lg">
            <BarChart3 className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">LineControl</h1>
            <p className="text-sm text-muted-foreground">Gestión corporativa de líneas y dispositivos</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          <Button type="button" variant="outline" className="w-full mb-4" onClick={signInWithMicrosoft}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg>
            Continuar con Microsoft
          </Button>
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">o con email</span></div>
          </div>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={onSignIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="e1">Email</Label>
                  <Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p1">Contraseña</Label>
                  <Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={onSignUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="n2">Nombre</Label>
                  <Input id="n2" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e2">Email</Label>
                  <Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p2">Contraseña</Label>
                  <Input id="p2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
