import { Download, PlugZap, RefreshCcw, Trash2 } from "lucide-react";
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

const settingTabs = ["Conexoes", "Aparencia", "Terminal", "Agentes", "Workspace", "Tokens", "Updates", "Avancado"];

export function SettingsDialog() {
  const open = useAppStore((state) => state.settingsOpen);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const connections = useAppStore((state) => state.connections);
  const updateConnection = useAppStore((state) => state.updateConnection);
  const addLog = useAppStore((state) => state.addLog);
  const activeAgentId = useAppStore((state) => state.activeAgentId);

  async function connect(provider: AgentModel) {
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
      <DialogContent className="h-[82vh] max-w-5xl p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configuracoes locais, conexoes CLI, workspace, tokens e backend.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="Conexoes" className="grid min-h-0 flex-1 grid-cols-[180px_1fr]">
          <TabsList className="m-4 h-auto flex-col items-stretch justify-start gap-1 bg-background p-1">
            {settingTabs.map((tab) => (
              <TabsTrigger value={tab} key={tab} className="justify-start">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="min-h-0 border-l">
            <div className="p-5">
              <TabsContent value="Conexoes" className="mt-0 space-y-4">
                {connections.map((connection) => (
                  <section key={connection.provider} className="rounded-md border bg-background p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">{connection.provider === "claude-code" ? "Claude Code" : "Codex"}</h3>
                        <p className="mt-1 text-xs text-text-muted">Login unico pelo CLI oficial, reutilizado por todos os agentes.</p>
                      </div>
                      <Badge variant={connection.connected ? "success" : connection.error ? "error" : "secondary"}>
                        {connection.connected ? "connected" : connection.error ? "error" : "disconnected"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs text-text-muted">
                      <div className="rounded-md border bg-surface p-3">
                        <p>Versao</p>
                        <p className="mt-1 truncate text-text">{connection.version ?? "nao verificada"}</p>
                      </div>
                      <div className="rounded-md border bg-surface p-3">
                        <p>Ultima verificacao</p>
                        <p className="mt-1 text-text">{connection.lastChecked ? new Date(connection.lastChecked).toLocaleString() : "nunca"}</p>
                      </div>
                      <div className="rounded-md border bg-surface p-3">
                        <p>Erro</p>
                        <p className="mt-1 truncate text-text">{connection.error ?? "nenhum"}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button onClick={() => connect(connection.provider)}>
                        <PlugZap />
                        Reconectar
                      </Button>
                      <Button variant="outline" onClick={() => connect(connection.provider)}>
                        Login pelo terminal
                      </Button>
                      <Button variant="outline" onClick={() => disconnect(connection.provider)}>
                        Desconectar conta
                      </Button>
                    </div>
                  </section>
                ))}
              </TabsContent>

              <TabsContent value="Aparencia" className="mt-0 space-y-4">
                <SettingGrid>
                  <NumberField label="Tamanho da fonte" value={settings.fontSize} onChange={(fontSize) => updateSettings({ fontSize })} />
                  <NumberField label="Linhas do terminal" value={settings.terminalRows} onChange={(terminalRows) => updateSettings({ terminalRows })} />
                  <SelectField label="Densidade" value={settings.density} options={["compact", "comfortable", "spacious"]} onChange={(density) => updateSettings({ density: density as typeof settings.density })} />
                  <SelectField label="Accent roxo" value={settings.accent} options={["violet", "purple", "fuchsia"]} onChange={(accent) => updateSettings({ accent: accent as typeof settings.accent })} />
                  <ToggleField label="Transparencia opcional" checked={settings.transparency} onChange={(transparency) => updateSettings({ transparency })} />
                  <ToggleField label="Animacoes" checked={settings.animations} onChange={(animations) => updateSettings({ animations })} />
                  <NumberField label="Zoom da interface" value={settings.zoom} onChange={(zoom) => updateSettings({ zoom })} />
                </SettingGrid>
              </TabsContent>

              <TabsContent value="Terminal" className="mt-0 space-y-4">
                <SettingGrid>
                  <ToggleField label="Cursor blinking" checked={settings.cursorBlink} onChange={(cursorBlink) => updateSettings({ cursorBlink })} />
                  <NumberField label="Scrollback size" value={settings.scrollback} onChange={(scrollback) => updateSettings({ scrollback })} />
                  <TextField label="Shell padrao" value={settings.defaultShell} placeholder="/bin/zsh ou powershell" onChange={(defaultShell) => updateSettings({ defaultShell })} />
                  <ToggleField label="Copiar ao selecionar" checked={settings.copyOnSelect} onChange={(copyOnSelect) => updateSettings({ copyOnSelect })} />
                  <ToggleField label="Colar com botao direito" checked={settings.pasteOnRightClick} onChange={(pasteOnRightClick) => updateSettings({ pasteOnRightClick })} />
                  <SelectField label="PTY performance" value={settings.ptyPerformance} options={["balanced", "latency", "throughput"]} onChange={(ptyPerformance) => updateSettings({ ptyPerformance: ptyPerformance as typeof settings.ptyPerformance })} />
                  <TextField label="Atalhos de teclado" value="Cmd/Ctrl+K, Cmd/Ctrl+Shift+P" onChange={() => undefined} />
                </SettingGrid>
              </TabsContent>

              <TabsContent value="Agentes" className="mt-0 space-y-4">
                <SettingGrid>
                  <TextField label="Templates padrao" value="Coder, Thinker, Reviewer, Researcher" onChange={() => undefined} />
                  <TextField label="Prompt padrao por funcao" value="Configurado por ROLE_PROMPTS" onChange={() => undefined} />
                  <TextField label="Cor padrao dos agentes" value="accent/success/error/text-muted" onChange={() => undefined} />
                  <ToggleField label="Auto restart" checked={settings.autoRestart} onChange={(autoRestart) => updateSettings({ autoRestart })} />
                  <NumberField label="Maximo de agentes" value={settings.maxAgents} onChange={(maxAgents) => updateSettings({ maxAgents })} />
                  <NumberField label="Timeout em minutos" value={settings.agentTimeout} onChange={(agentTimeout) => updateSettings({ agentTimeout })} />
                </SettingGrid>
              </TabsContent>

              <TabsContent value="Workspace" className="mt-0 space-y-4">
                <SettingGrid>
                  <TextField label="Pasta padrao de projetos" value={settings.defaultProjectsPath} placeholder="/Users/name/Developer" onChange={(defaultProjectsPath) => updateSettings({ defaultProjectsPath })} />
                  <TextField label="Historico de workspaces" value="Local Workspace" onChange={() => undefined} />
                  <ToggleField label="Auto-save" checked={settings.autoSave} onChange={(autoSave) => updateSettings({ autoSave })} />
                  <ToggleField label="Sincronizacao offline" checked={settings.offlineSync} onChange={(offlineSync) => updateSettings({ offlineSync })} />
                  <TextField label="Supabase URL" value={settings.supabaseUrl} onChange={(supabaseUrl) => updateSettings({ supabaseUrl })} />
                  <TextField label="Supabase anon key" value="" placeholder="defina por ambiente ou secret store" onChange={() => undefined} />
                </SettingGrid>
              </TabsContent>

              <TabsContent value="Tokens" className="mt-0 space-y-4">
                <SettingGrid>
                  <NumberField label="Limite de tokens" value={settings.tokenLimit} onChange={(tokenLimit) => updateSettings({ tokenLimit })} />
                  <NumberField label="Alerta de custo" value={settings.costAlert} onChange={(costAlert) => updateSettings({ costAlert })} />
                  <ToggleField label="Reset diario" checked={settings.dailyReset} onChange={(dailyReset) => updateSettings({ dailyReset })} />
                  <TextField label="Historico de uso" value="Persistido localmente e pronto para Supabase" onChange={() => undefined} />
                  <Button variant="outline">
                    <Download />
                    Exportar estatisticas
                  </Button>
                </SettingGrid>
              </TabsContent>

              <TabsContent value="Updates" className="mt-0 space-y-4">
                <SettingGrid>
                  <SelectField label="Canal" value={settings.updateChannel} options={["alpha", "beta", "stable"]} onChange={(updateChannel) => updateSettings({ updateChannel: updateChannel as typeof settings.updateChannel })} />
                  <ToggleField label="Auto update" checked={settings.autoUpdate} onChange={(autoUpdate) => updateSettings({ autoUpdate })} />
                  <Button variant="outline">
                    <RefreshCcw />
                    Verificar updates
                  </Button>
                  <TextField label="Changelog" value="0.1.0 alpha: scaffold desktop, PTY, agentes, settings" onChange={() => undefined} />
                </SettingGrid>
              </TabsContent>

              <TabsContent value="Avancado" className="mt-0 space-y-4">
                <SettingGrid>
                  <TextField label="Logs do sistema" value="Disponiveis no painel do agente" onChange={() => undefined} />
                  <ToggleField label="Debug mode" checked={settings.debugMode} onChange={(debugMode) => updateSettings({ debugMode })} />
                  <ToggleField label="Eventos Tauri" checked={settings.tauriEvents} onChange={(tauriEvents) => updateSettings({ tauriEvents })} />
                  <SelectField label="Backend Rust log level" value={settings.backendLogLevel} options={["error", "warn", "info", "debug"]} onChange={(backendLogLevel) => updateSettings({ backendLogLevel: backendLogLevel as typeof settings.backendLogLevel })} />
                  <Button variant="outline">
                    <Trash2 />
                    Limpar cache
                  </Button>
                  <Button variant="destructive">
                    <Trash2 />
                    Reset completo
                  </Button>
                </SettingGrid>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SettingGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
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

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <FieldShell label={label}>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </FieldShell>
  );
}

function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <FieldShell label={label}>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
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
