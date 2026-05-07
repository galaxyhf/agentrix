import { CheckCircle2, PlugZap, Terminal, XCircle } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkCliStatus } from "@/lib/tauri";
import { useAppStore } from "@/store/app-store";
import type { AgentModel } from "@/lib/types";

const settingTabs = ["Conexoes", "Aparencia"];

export function SettingsDialog() {
  const open = useAppStore((state) => state.settingsOpen);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const connections = useAppStore((state) => state.connections);
  const updateConnection = useAppStore((state) => state.updateConnection);
  const addLog = useAppStore((state) => state.addLog);
  const activeAgentId = useAppStore((state) => state.activeAgentId);

  async function checkProvider(provider: AgentModel) {
    try {
      const version = await checkCliStatus(provider);
      updateConnection(provider, {
        connected: true,
        version,
        lastChecked: new Date().toISOString(),
        error: undefined,
      });
      addLog(activeAgentId, "info", `${provider} CLI detectado: ${version}`);
    } catch (error) {
      updateConnection(provider, {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function disconnect(provider: AgentModel) {
    updateConnection(provider, { connected: false, error: undefined });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="h-[70vh] max-w-4xl p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Conexoes locais dos CLIs e aparencia do app.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="Conexoes" className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)] overflow-hidden">
          <TabsList className="m-4 flex h-[calc(70vh-8rem)] flex-col items-stretch justify-start gap-1 self-start bg-background p-1">
            {settingTabs.map((tab) => (
              <TabsTrigger value={tab} key={tab} className="justify-start">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 overflow-hidden border-l">
            <ScrollArea className="h-[calc(70vh-8rem)]">
              <div className="p-5">
                <TabsContent value="Conexoes" className="m-0 space-y-4">
                  {connections.map((connection) => (
                    <section key={connection.provider} className="rounded-md border bg-background p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-md border bg-surface">
                            <Terminal className="size-4 text-accent" />
                          </div>
                          <div>
                            <h3 className="text-sm font-medium">{connection.provider === "claude-code" ? "Claude Code" : "Codex"}</h3>
                            <p className="mt-1 text-xs text-text-muted">Use o login do CLI oficial direto em qualquer terminal do Agentrix.</p>
                          </div>
                        </div>
                        <Badge variant={connection.connected ? "success" : connection.error ? "error" : "secondary"}>
                          {connection.connected ? "detectado" : connection.error ? "erro" : "nao verificado"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs text-text-muted">
                        <StatusBox label="Status" value={connection.connected ? "CLI disponivel" : "CLI nao confirmado"} ok={connection.connected} />
                        <InfoBox label="Versao" value={connection.version ?? "nao verificada"} />
                        <InfoBox label="Ultima verificacao" value={connection.lastChecked ? new Date(connection.lastChecked).toLocaleString() : "nunca"} />
                      </div>

                      {connection.error && <p className="mt-3 rounded-md border border-error bg-card p-3 text-xs text-error">{connection.error}</p>}

                      <div className="mt-4 flex gap-2">
                        <Button onClick={() => checkProvider(connection.provider)}>
                          <PlugZap />
                          Verificar CLI
                        </Button>
                        <Button variant="outline" onClick={() => disconnect(connection.provider)}>
                          Limpar status
                        </Button>
                      </div>
                    </section>
                  ))}
                </TabsContent>

                <TabsContent value="Aparencia" className="m-0 space-y-4">
                  <SettingGrid>
                    <NumberField label="Tamanho da fonte" value={settings.fontSize} min={10} max={22} onChange={(fontSize) => updateSettings({ fontSize })} />
                    <SelectField label="Densidade" value={settings.density} options={["compact", "comfortable", "spacious"]} onChange={(density) => updateSettings({ density: density as typeof settings.density })} />
                    <SelectField label="Accent roxo" value={settings.accent} options={["violet", "purple", "fuchsia"]} onChange={(accent) => updateSettings({ accent: accent as typeof settings.accent })} />
                    <NumberField label="Zoom da interface" value={settings.zoom} min={75} max={150} onChange={(zoom) => updateSettings({ zoom })} />
                    <ToggleField label="Transparencia" checked={settings.transparency} onChange={(transparency) => updateSettings({ transparency })} />
                    <ToggleField label="Animacoes" checked={settings.animations} onChange={(animations) => updateSettings({ animations })} />
                    <ToggleField label="Cursor piscando" checked={settings.cursorBlink} onChange={(cursorBlink) => updateSettings({ cursorBlink })} />
                    <ToggleField label="Copiar ao selecionar" checked={settings.copyOnSelect} onChange={(copyOnSelect) => updateSettings({ copyOnSelect })} />
                  </SettingGrid>
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SettingGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-surface p-3">
      <p>{label}</p>
      <p className="mt-1 truncate text-text">{value}</p>
    </div>
  );
}

function StatusBox({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-md border bg-surface p-3">
      <p>{label}</p>
      <div className="mt-1 flex items-center gap-2 text-text">
        {ok ? <CheckCircle2 className="size-3.5 text-success" /> : <XCircle className="size-3.5 text-text-muted" />}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label>{label}</Label>
      </div>
      {children}
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <FieldShell label={label}>
      <Input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </FieldShell>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <FieldShell label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem value={option} key={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background p-4">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
