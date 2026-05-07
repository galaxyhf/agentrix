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
  const agents = useAppStore((state) => state.agents);
  const logs = useAppStore((state) => state.logs);
  const workspaces = useAppStore((state) => state.workspaces);
  const clearCache = useAppStore((state) => state.clearCache);
  const resetApp = useAppStore((state) => state.resetApp);

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

  function exportStats() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            workspaces,
            agents: agents.map((agent) => ({
              id: agent.id,
              name: agent.name,
              role: agent.role,
              status: agent.status,
              tokens: agent.tokens,
            })),
            logs,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `agentrix-stats-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="h-[82vh] max-w-5xl p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configuracoes locais, conexoes CLI, workspace, tokens e backend.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="Conexoes" className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)] overflow-hidden">
          <TabsList className="m-4 flex h-[calc(82vh-8rem)] flex-col items-stretch justify-start gap-1 self-start bg-background p-1">
            {settingTabs.map((tab) => (
              <TabsTrigger value={tab} key={tab} className="justify-start">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 overflow-hidden border-l">
            <ScrollArea className="h-[calc(82vh-8rem)]">
              <div className="p-5">
                <TabsContent value="Conexoes" className="m-0 space-y-4">
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
                      <Button variant="outline" disabled>
                        Login pelo terminal
                      </Button>
                      <Button variant="outline" onClick={() => disconnect(connection.provider)}>
                        Desconectar conta
                      </Button>
                    </div>
                  </section>
                ))}
              </TabsContent>

                <TabsContent value="Aparencia" className="m-0 space-y-4">
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

                <TabsContent value="Terminal" className="m-0 space-y-4">
                <SettingGrid>
                  <ToggleField label="Cursor blinking" checked={settings.cursorBlink} onChange={(cursorBlink) => updateSettings({ cursorBlink })} />
                  <NumberField label="Scrollback size" value={settings.scrollback} onChange={(scrollback) => updateSettings({ scrollback })} />
                  <TextField label="Shell padrao" value={settings.defaultShell} placeholder="/bin/zsh ou powershell" onChange={(defaultShell) => updateSettings({ defaultShell })} />
                  <ToggleField label="Copiar ao selecionar" checked={settings.copyOnSelect} onChange={(copyOnSelect) => updateSettings({ copyOnSelect })} />
                  <ToggleField label="Colar com botao direito" checked={settings.pasteOnRightClick} onChange={(pasteOnRightClick) => updateSettings({ pasteOnRightClick })} />
                  <SelectField label="PTY performance" value={settings.ptyPerformance} options={["balanced", "latency", "throughput"]} onChange={(ptyPerformance) => updateSettings({ ptyPerformance: ptyPerformance as typeof settings.ptyPerformance })} disabled />
                  <TextField label="Atalhos de teclado" value="Cmd/Ctrl+K, Cmd/Ctrl+Shift+P" onChange={() => undefined} disabled />
                </SettingGrid>
              </TabsContent>

                <TabsContent value="Agentes" className="m-0 space-y-4">
                <SettingGrid>
                  <TextField label="Templates padrao" value="Coder, Thinker, Reviewer, Researcher" onChange={() => undefined} disabled />
                  <TextField label="Prompt padrao por funcao" value="Configurado por ROLE_PROMPTS" onChange={() => undefined} disabled />
                  <TextField label="Cor padrao dos agentes" value="accent/success/error/text-muted" onChange={() => undefined} disabled />
                  <ToggleField label="Auto restart" checked={settings.autoRestart} onChange={(autoRestart) => updateSettings({ autoRestart })} disabled />
                  <NumberField label="Maximo de agentes" value={settings.maxAgents} onChange={(maxAgents) => updateSettings({ maxAgents })} />
                  <NumberField label="Timeout em minutos" value={settings.agentTimeout} onChange={(agentTimeout) => updateSettings({ agentTimeout })} disabled />
                </SettingGrid>
              </TabsContent>

                <TabsContent value="Workspace" className="m-0 space-y-4">
                <SettingGrid>
                  <TextField label="Pasta padrao de projetos" value={settings.defaultProjectsPath} placeholder="/Users/name/Developer" onChange={(defaultProjectsPath) => updateSettings({ defaultProjectsPath })} />
                  <TextField label="Historico de workspaces" value="Local Workspace" onChange={() => undefined} disabled />
                  <ToggleField label="Auto-save" checked={settings.autoSave} onChange={(autoSave) => updateSettings({ autoSave })} disabled />
                  <ToggleField label="Sincronizacao offline" checked={settings.offlineSync} onChange={(offlineSync) => updateSettings({ offlineSync })} disabled />
                  <TextField label="Supabase URL" value={settings.supabaseUrl} onChange={(supabaseUrl) => updateSettings({ supabaseUrl })} />
                  <TextField label="Supabase anon key" value="" placeholder="defina por ambiente ou secret store" onChange={() => undefined} disabled />
                </SettingGrid>
              </TabsContent>

                <TabsContent value="Tokens" className="m-0 space-y-4">
                <SettingGrid>
                  <NumberField label="Limite de tokens" value={settings.tokenLimit} onChange={(tokenLimit) => updateSettings({ tokenLimit })} disabled />
                  <NumberField label="Alerta de custo" value={settings.costAlert} onChange={(costAlert) => updateSettings({ costAlert })} disabled />
                  <ToggleField label="Reset diario" checked={settings.dailyReset} onChange={(dailyReset) => updateSettings({ dailyReset })} disabled />
                  <TextField label="Historico de uso" value="Persistido localmente" onChange={() => undefined} disabled />
                  <Button variant="outline" onClick={exportStats}>
                    <Download />
                    Exportar estatisticas
                  </Button>
                </SettingGrid>
              </TabsContent>

                <TabsContent value="Updates" className="m-0 space-y-4">
                <SettingGrid>
                  <SelectField label="Canal" value={settings.updateChannel} options={["alpha", "beta", "stable"]} onChange={(updateChannel) => updateSettings({ updateChannel: updateChannel as typeof settings.updateChannel })} disabled />
                  <ToggleField label="Auto update" checked={settings.autoUpdate} onChange={(autoUpdate) => updateSettings({ autoUpdate })} disabled />
                  <Button variant="outline" disabled>
                    <RefreshCcw />
                    Verificar updates
                  </Button>
                  <TextField label="Changelog" value="0.1.0 alpha: scaffold desktop, PTY, agentes, settings" onChange={() => undefined} disabled />
                </SettingGrid>
              </TabsContent>

                <TabsContent value="Avancado" className="m-0 space-y-4">
                <SettingGrid>
                  <TextField label="Logs do sistema" value={`${logs.length} logs locais registrados`} onChange={() => undefined} disabled />
                  <ToggleField label="Debug mode" checked={settings.debugMode} onChange={(debugMode) => updateSettings({ debugMode })} disabled />
                  <ToggleField label="Eventos Tauri" checked={settings.tauriEvents} onChange={(tauriEvents) => updateSettings({ tauriEvents })} disabled />
                  <SelectField label="Backend Rust log level" value={settings.backendLogLevel} options={["error", "warn", "info", "debug"]} onChange={(backendLogLevel) => updateSettings({ backendLogLevel: backendLogLevel as typeof settings.backendLogLevel })} disabled />
                  <Button variant="outline" onClick={clearCache}>
                    <Trash2 />
                    Limpar cache
                  </Button>
                  <Button variant="destructive" onClick={resetApp}>
                    <Trash2 />
                    Reset completo
                  </Button>
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

function FieldShell({ label, children, disabled }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div className={disabled ? "rounded-md border bg-background p-4 opacity-60" : "rounded-md border bg-background p-4"}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {disabled && <Badge variant="secondary">em breve</Badge>}
      </div>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <FieldShell label={label} disabled={disabled}>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} />
    </FieldShell>
  );
}

function TextField({ label, value, placeholder, onChange, disabled }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <FieldShell label={label} disabled={disabled}>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </FieldShell>
  );
}

function SelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <FieldShell label={label} disabled={disabled}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
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

function ToggleField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <div className={disabled ? "flex items-center justify-between rounded-md border bg-background p-4 opacity-60" : "flex items-center justify-between rounded-md border bg-background p-4"}>
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        {disabled && <Badge variant="secondary">em breve</Badge>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
