import { CheckCircle2, ExternalLink, PlugZap, Terminal, XCircle } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkCliStatus, getHostPlatform, type CliStatus, type HostPlatform } from "@/lib/tauri";
import { useAppStore } from "@/store/app-store";
import type { AgentModel } from "@/lib/types";

const settingTabs = ["Conexoes", "Aparencia"];

const cliSetup: Record<
  AgentModel,
  {
    title: string;
    install: Record<Exclude<HostPlatform, "web">, string>;
    login: string;
    docsUrl: string;
    setupCommand: Record<Exclude<HostPlatform, "web">, string>;
  }
> = {
  "claude-code": {
    title: "Claude Code",
    install: {
      macos: "npm install -g @anthropic-ai/claude-code",
      unix: "npm install -g @anthropic-ai/claude-code",
      windows: "npm install -g @anthropic-ai/claude-code",
    },
    login: "claude auth login",
    docsUrl: "https://docs.anthropic.com/en/docs/claude-code/getting-started",
    setupCommand: {
      macos:
        "printf '\\nAgentrix: configurando Claude Code...\\n'; if ! command -v claude >/dev/null 2>&1; then npm install -g @anthropic-ai/claude-code; fi; claude --version; claude auth status --text || claude auth login || claude",
      unix:
        "printf '\\nAgentrix: configurando Claude Code...\\n'; if ! command -v claude >/dev/null 2>&1; then npm install -g @anthropic-ai/claude-code; fi; claude --version; claude auth status --text || claude auth login || claude",
      windows:
        "powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command \"& { Write-Host ''; Write-Host 'Agentrix: configurando Claude Code...'; if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { npm install -g @anthropic-ai/claude-code }; claude --version; claude auth status --text; if (`$LASTEXITCODE -ne 0) { claude auth login; if (`$LASTEXITCODE -ne 0) { claude } } }\"",
    },
  },
  codex: {
    title: "Codex",
    install: {
      macos: "npm install -g @openai/codex",
      unix: "npm install -g @openai/codex",
      windows: "npm install -g @openai/codex",
    },
    login: "codex login",
    docsUrl: "https://github.com/openai/codex",
    setupCommand: {
      macos:
        "printf '\\nAgentrix: configurando Codex CLI...\\n'; if ! command -v codex >/dev/null 2>&1; then npm install -g @openai/codex; fi; codex --version; if [ -n \"$OPENAI_API_KEY\" ]; then printf 'OPENAI_API_KEY encontrado.\\n'; else codex login status || codex --login; fi",
      unix:
        "printf '\\nAgentrix: configurando Codex CLI...\\n'; if ! command -v codex >/dev/null 2>&1; then npm install -g @openai/codex; fi; codex --version; if [ -n \"$OPENAI_API_KEY\" ]; then printf 'OPENAI_API_KEY encontrado.\\n'; else codex login status || codex --login; fi",
      windows:
        "powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command \"& { Write-Host ''; Write-Host 'Agentrix: configurando Codex CLI...'; if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { npm install -g @openai/codex }; codex --version; if (`$env:OPENAI_API_KEY) { Write-Host 'OPENAI_API_KEY encontrado.' } else { codex login status; if (`$LASTEXITCODE -ne 0) { codex --login } } }\"",
    },
  },
  gemini: {
    title: "Gemini CLI",
    install: {
      macos: "npm install -g @google/gemini-cli",
      unix: "npm install -g @google/gemini-cli",
      windows: "npm install -g @google/gemini-cli",
    },
    login: "gemini",
    docsUrl: "https://google-gemini.github.io/gemini-cli/docs/get-started/",
    setupCommand: {
      macos:
        "printf '\\nAgentrix: configurando Gemini CLI...\\n'; if ! command -v gemini >/dev/null 2>&1; then npm install -g @google/gemini-cli; fi; gemini --version; printf '\\nSe o login ainda nao estiver pronto, escolha Login with Google no Gemini CLI.\\n'; gemini",
      unix:
        "printf '\\nAgentrix: configurando Gemini CLI...\\n'; if ! command -v gemini >/dev/null 2>&1; then npm install -g @google/gemini-cli; fi; gemini --version; printf '\\nSe o login ainda nao estiver pronto, escolha Login with Google no Gemini CLI.\\n'; gemini",
      windows:
        "powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command \"& { Write-Host ''; Write-Host 'Agentrix: configurando Gemini CLI...'; if (-not (Get-Command gemini -ErrorAction SilentlyContinue)) { npm install -g @google/gemini-cli }; gemini --version; Write-Host ''; Write-Host 'Se o login ainda nao estiver pronto, escolha Login with Google no Gemini CLI.'; gemini }\"",
    },
  },
};

export function SettingsDialog() {
  const [hostPlatform, setHostPlatform] = useState<HostPlatform>("web");
  const open = useAppStore((state) => state.settingsOpen);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const connections = useAppStore((state) => state.connections);
  const updateConnection = useAppStore((state) => state.updateConnection);
  const addLog = useAppStore((state) => state.addLog);
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const configureWorkspace = useAppStore((state) => state.configureWorkspace);
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const setupPlatform = useMemo(() => normalizeSetupPlatform(hostPlatform), [hostPlatform]);

  useEffect(() => {
    void getHostPlatform().then(setHostPlatform).catch(() => setHostPlatform("web"));
  }, []);

  async function checkProvider(provider: AgentModel) {
    try {
      const status = await checkCliStatus(provider);
      const connected = status.installed && status.authenticated;
      updateConnection(provider, {
        connected,
        installed: status.installed,
        authenticated: status.authenticated,
        version: status.version,
        executable: status.executable,
        lastChecked: new Date().toISOString(),
        error: connectionError(status),
        authMessage: status.authMessage,
        installHint: status.installHint,
        loginHint: status.loginHint,
      });
      addLog(activeAgentId, connected ? "info" : "warn", connectionLogMessage(provider, status));
    } catch (error) {
      updateConnection(provider, {
        connected: false,
        installed: false,
        authenticated: false,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function disconnect(provider: AgentModel) {
    updateConnection(provider, { connected: false, error: undefined });
  }

  async function openDocs(provider: AgentModel) {
    const url = cliSetup[provider].docsUrl;
    if (!window.__TAURI_INTERNALS__) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  }

  async function runCliSetup(provider: AgentModel) {
    const setup = cliSetup[provider];
    let setupPath = useAppStore.getState().settings.defaultProjectsPath;
    if (!setupPath) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          title: "Selecionar pasta para configurar CLI",
        });
        if (typeof selected !== "string") {
          return;
        }
        setupPath = selected;
        updateSettings({ defaultProjectsPath: selected });
      } catch (error) {
        addLog(activeAgentId, "error", error instanceof Error ? error.message : String(error));
        return;
      }
    }
    setOpen(false);
    addWorkspace(setupPath, `Setup ${setup.title}`);
    const workspaceId = useAppStore.getState().activeWorkspaceId;
    configureWorkspace(
      workspaceId,
      provider === "codex" ? 1 : 0,
      provider === "claude-code" ? 1 : 0,
      provider === "gemini" ? 1 : 0,
      setup.setupCommand[setupPlatform],
    );
    addLog(activeAgentId, "info", `Setup do ${setup.title} iniciado no terminal embutido.`);
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
                      {(() => {
                        const setup = cliSetup[connection.provider];
                        return (
                          <>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-md border bg-surface">
                            <Terminal className="size-4 text-accent" />
                          </div>
                          <div>
                            <h3 className="text-sm font-medium">{setup.title}</h3>
                            <p className="mt-1 text-xs text-text-muted">Instale, verifique e autentique pelo fluxo oficial no terminal embutido.</p>
                          </div>
                        </div>
                        <Badge variant={connection.connected ? "success" : connection.error ? "error" : "secondary"}>
                          {connection.connected ? "pronto" : connection.error ? "acao necessaria" : "nao verificado"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-4 gap-3 text-xs text-text-muted">
                        <StatusBox label="Instalacao" value={connection.installed ? "instalado" : "nao confirmado"} ok={Boolean(connection.installed)} />
                        <StatusBox label="Login" value={connection.authenticated ? "autenticado" : "pendente"} ok={Boolean(connection.authenticated)} />
                        <InfoBox label="Versao" value={connection.version ?? "nao verificada"} />
                        <InfoBox label="Ultima verificacao" value={connection.lastChecked ? new Date(connection.lastChecked).toLocaleString() : "nunca"} />
                      </div>

                      {connection.error && <p className="mt-3 rounded-md border border-error bg-card p-3 text-xs text-error">{connection.error}</p>}
                      {connection.authMessage && !connection.error && <p className="mt-3 rounded-md border bg-card p-3 text-xs text-text-muted">{connection.authMessage}</p>}

                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-text-muted">
                        <InfoBox label="Instalacao oficial" value={setup.install[setupPlatform]} />
                        <InfoBox label="Login oficial" value={setup.login} />
                        <InfoBox label="Executavel" value={connection.executable ?? "auto"} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={() => void runCliSetup(connection.provider)}>
                          <Terminal />
                          Instalar / login
                        </Button>
                        <Button onClick={() => checkProvider(connection.provider)}>
                          <PlugZap />
                          Verificar CLI
                        </Button>
                        <Button variant="outline" onClick={() => void openDocs(connection.provider)}>
                          <ExternalLink />
                          Docs oficiais
                        </Button>
                        <Button variant="outline" onClick={() => disconnect(connection.provider)}>
                          Limpar status
                        </Button>
                      </div>
                          </>
                        );
                      })()}
                    </section>
                  ))}
                </TabsContent>

                <TabsContent value="Aparencia" className="m-0 space-y-4">
                  <SettingGrid>
                    <NumberField label="Tamanho da fonte" value={settings.fontSize} min={10} max={22} onChange={(fontSize) => updateSettings({ fontSize })} />
                    <SelectField label="Densidade" value={settings.density} options={["compact", "comfortable", "spacious"]} onChange={(density) => updateSettings({ density: density as typeof settings.density })} />
                    <SelectField label="Accent de cor" value={settings.accent} options={["violet", "purple", "fuchsia", "red"]} onChange={(accent) => updateSettings({ accent: accent as typeof settings.accent })} />
                    <LayoutModeField value={settings.workspaceLayout} onChange={(workspaceLayout) => updateSettings({ workspaceLayout })} />
                    <NumberField label="Zoom da interface" value={settings.zoom} min={75} max={150} onChange={(zoom) => updateSettings({ zoom })} />
                    <TextField label="Shell padrao" value={settings.defaultShell} placeholder="auto" onChange={(defaultShell) => updateSettings({ defaultShell })} />
                    <ToggleField label="Cursor piscando" checked={settings.cursorBlink} onChange={(cursorBlink) => updateSettings({ cursorBlink })} />
                    <ToggleField label="Colar com botao direito" checked={settings.pasteOnRightClick} onChange={(pasteOnRightClick) => updateSettings({ pasteOnRightClick })} />
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

function normalizeSetupPlatform(platform: HostPlatform): Exclude<HostPlatform, "web"> {
  if (platform === "windows" || platform === "macos") {
    return platform;
  }
  return "unix";
}

function connectionError(status: CliStatus) {
  if (!status.installed) {
    return status.installMessage ?? `CLI nao encontrado. Instale com: ${status.installHint}`;
  }
  if (!status.authenticated) {
    return status.authMessage ?? `Login nao confirmado. Rode: ${status.loginHint}`;
  }
  return undefined;
}

function connectionLogMessage(provider: AgentModel, status: CliStatus) {
  if (status.installed && status.authenticated) {
    return `${provider} pronto: ${status.version ?? "versao nao informada"}`;
  }
  if (!status.installed) {
    return `${provider} nao instalado. ${status.installHint}`;
  }
  return `${provider} instalado, mas login pendente. ${status.loginHint}`;
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

function LayoutModeField({ value, onChange }: { value: "single" | "grid"; onChange: (value: "single" | "grid") => void }) {
  return (
    <FieldShell label="Modo dos workspaces">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={value === "single" ? "default" : "outline"}
          onClick={() => onChange("single")}
          className="justify-center"
        >
          1 terminal
        </Button>
        <Button
          type="button"
          variant={value === "grid" ? "default" : "outline"}
          onClick={() => onChange("grid")}
          className="justify-center"
        >
          Grid
        </Button>
      </div>
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
