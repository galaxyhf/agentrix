import { ArrowRight, Database, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";

export function LoginPage() {
  const setAuthenticated = useAppStore((state) => state.setAuthenticated);
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);

  return (
    <main className="grid h-full place-items-center bg-background px-6 text-text">
      <section className="w-full max-w-md rounded-md border bg-surface p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">AGENTRIX</h1>
            <p className="mt-1 text-sm text-text-muted">Desktop AI agent orchestrator</p>
          </div>
          <Badge>v0.3.0</Badge>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border bg-card p-4">
            <div className="flex items-center gap-3">
              <Terminal className="size-5 text-accent" />
              <div>
                <p className="text-sm font-medium">Modo local</p>
                <p className="text-xs text-text-muted">Terminais, workspaces e configuracoes funcionam offline.</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-text-muted" htmlFor="supabase-url">
              Supabase URL opcional
            </Label>
            <div className="flex gap-2">
              <Input
                id="supabase-url"
                value={settings.supabaseUrl}
                placeholder="https://project.supabase.co"
                onChange={(event) => updateSettings({ supabaseUrl: event.target.value })}
              />
              <Button variant="outline" size="icon" aria-label="Supabase">
                <Database />
              </Button>
            </div>
          </div>

          <Separator />

          <Button className="w-full" onClick={() => setAuthenticated(true)}>
            Entrar no workspace
            <ArrowRight />
          </Button>
        </div>
      </section>
    </main>
  );
}
