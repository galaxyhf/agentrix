import { useState } from "react";
import { Bot, Code2, FolderOpen, Minus, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TerminalPane } from "@/components/terminal/terminal-pane";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

export function MainWorkspace() {
  const allAgents = useAppStore((state) => state.agents);
  const workspaces = useAppStore((state) => state.workspaces);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const settings = useAppStore((state) => state.settings);
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);
  const configureWorkspace = useAppStore((state) => state.configureWorkspace);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const activeWorkspaceAgents = activeWorkspace ? allAgents.filter((agent) => agent.workspace_id === activeWorkspace.id) : [];
  const visibleAgentId = activeWorkspaceAgents.some((agent) => agent.id === activeAgentId) ? activeAgentId : activeWorkspaceAgents[0]?.id;
  const expandedAgent = expandedAgentId ? activeWorkspaceAgents.find((agent) => agent.id === expandedAgentId) : null;
  const isGridLayout = settings.workspaceLayout === "grid";
  const gridColumns = isGridLayout ? gridColumnCount(activeWorkspaceAgents.length) : 1;

  if (!activeWorkspace) {
    return (
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <section className="grid min-h-0 flex-1 place-items-center bg-terminal-bg p-8">
          <div className="max-w-md text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-md border bg-surface text-text">
              <FolderOpen className="size-5" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-text">Nenhum workspace aberto</h2>
            <p className="mt-2 text-xs leading-5 text-text-muted">
              Crie um workspace pela sidebar ou pelo menu Arquivo. Primeiro voce seleciona a pasta do projeto; depois configura quantos terminais abrir e qual CLI usar.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (activeWorkspaceAgents.length === 0) {
    return (
      <main className="relative min-w-0 flex-1 overflow-hidden bg-background">
        <WorkspaceSetup workspaceName={activeWorkspace.name} workspacePath={activeWorkspace.path} onStart={(codexCount, claudeCount) => configureWorkspace(activeWorkspace.id, codexCount, claudeCount)} />
      </main>
    );
  }

  return (
    <main
      className={cn(
        "relative min-w-0 flex-1 overflow-hidden bg-background",
        expandedAgent
          ? "relative"
          : isGridLayout
          ? "grid auto-rows-fr gap-2 p-2"
          : "relative",
      )}
      style={!expandedAgent && isGridLayout ? { gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` } : undefined}
    >
      {activeWorkspaceAgents.map((agent) => {
        const isExpanded = expandedAgent?.id === agent.id;
        const isVisible = expandedAgent ? isExpanded : isGridLayout || agent.id === visibleAgentId;
        return (
          <section
            key={agent.id}
            className={cn(
              "min-h-0 min-w-0 overflow-hidden bg-terminal-bg",
              expandedAgent
                ? isExpanded
                  ? "visible absolute inset-0 z-20 opacity-100"
                  : "invisible pointer-events-none absolute inset-0 z-0 opacity-0"
                : isGridLayout
                ? "relative rounded-md border"
                : isVisible
                  ? "visible absolute inset-0 z-10 opacity-100"
                  : "invisible pointer-events-none absolute inset-0 z-0 opacity-0",
              isGridLayout && agent.id === visibleAgentId && "border-accent ring-1 ring-inset ring-accent",
            )}
            aria-hidden={!isVisible}
            onFocus={() => {
              if (isGridLayout) {
                setActiveAgent(agent.id);
              }
            }}
            onClick={() => {
              if (isGridLayout) {
                setActiveAgent(agent.id);
              }
            }}
          >
            <TerminalPane
              agent={agent}
              visible={isVisible}
              expanded={isExpanded}
              onToggleExpanded={() => {
                setExpandedAgentId((current) => (current === agent.id ? null : agent.id));
                setActiveAgent(agent.id);
              }}
            />
          </section>
        );
      })}
    </main>
  );
}

function gridColumnCount(count: number) {
  if (count <= 1) {
    return 1;
  }
  if (count <= 4) {
    return 2;
  }
  return 3;
}

interface WorkspaceSetupProps {
  workspaceName: string;
  workspacePath: string;
  onStart: (codexCount: number, claudeCount: number) => void;
}

function WorkspaceSetup({ workspaceName, workspacePath, onStart }: WorkspaceSetupProps) {
  const settings = useAppStore((state) => state.settings);
  const saveWorkspaceProfile = useAppStore((state) => state.saveWorkspaceProfile);
  const availableSlots = settings.maxAgents;
  const [codexCount, setCodexCount] = useState(availableSlots >= 2 ? 1 : Math.min(1, availableSlots));
  const [claudeCount, setClaudeCount] = useState(availableSlots >= 2 ? 1 : 0);
  const [profileName, setProfileName] = useState("");
  const totalCount = codexCount + claudeCount;
  const canCreateTerminals = totalCount > 0;
  const profiles = settings.workspaceProfiles;

  function updateCodexCount(next: number) {
    const normalized = Math.min(Math.max(0, next), availableSlots);
    setCodexCount(normalized);
    setClaudeCount((current) => Math.min(current, Math.max(0, availableSlots - normalized)));
  }

  function updateClaudeCount(next: number) {
    const normalized = Math.min(Math.max(0, next), availableSlots);
    setClaudeCount(normalized);
    setCodexCount((current) => Math.min(current, Math.max(0, availableSlots - normalized)));
  }

  function saveProfile() {
    saveWorkspaceProfile({
      name: profileName,
      codexCount,
      claudeCount,
    });
    setProfileName("");
  }

  function applyProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }
    const nextCodexCount = Math.min(profile.codexCount, availableSlots);
    const nextClaudeCount = Math.min(profile.claudeCount, Math.max(0, availableSlots - nextCodexCount));
    setCodexCount(nextCodexCount);
    setClaudeCount(nextClaudeCount);
    onStart(nextCodexCount, nextClaudeCount);
  }

  return (
    <section className="relative z-10 flex h-full min-h-0 flex-col bg-terminal-bg px-8 py-7">
      <div className="mx-auto flex h-full max-w-4xl flex-col justify-center">
        <div className="mb-7">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">Configurar workspace</p>
          <h2 className="mt-2 text-2xl font-semibold text-text">{workspaceName}</h2>
          <p className="mt-2 max-w-2xl truncate text-xs text-text-muted">{workspacePath}</p>
        </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border bg-background p-4">
              <TerminalCountControl
                icon={Code2}
                label="Codex"
                description="Terminais que abrem direto no Codex CLI."
                value={codexCount}
                max={availableSlots}
                onChange={updateCodexCount}
              />
            </section>

            <section className="rounded-md border bg-background p-4">
              <TerminalCountControl
                icon={Bot}
                label="Claude Code"
                description="Terminais que abrem direto no Claude Code CLI."
                value={claudeCount}
                max={availableSlots}
                onChange={updateClaudeCount}
              />
            </section>
          </div>

          <p className="mt-3 text-xs leading-5 text-text-muted">
            Total: {totalCount} de {availableSlots} {availableSlots === 1 ? "terminal" : "terminais"} neste workspace.
          </p>

          <section className="mt-4 rounded-md border bg-background p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <h3 className="text-sm font-semibold text-text">Perfil</h3>
                <p className="mt-1 text-xs leading-5 text-text-muted">
                  Salve a combinacao atual ou selecione um perfil para criar os terminais agora.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select onValueChange={applyProfile} disabled={!canCreateTerminals || profiles.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={profiles.length === 0 ? "Nenhum perfil salvo" : "Selecionar perfil"} />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name} · Codex {profile.codexCount} · Claude {profile.claudeCount}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex min-w-0 gap-2">
                  <Input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="Nome do perfil"
                    className="min-w-0"
                  />
                  <Button variant="outline" size="icon" onClick={saveProfile} disabled={!profileName.trim()} aria-label="Salvar perfil">
                    <Save />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-5 flex justify-end">
            <Button onClick={() => onStart(codexCount, claudeCount)} disabled={!canCreateTerminals} className="gap-2">
              <Plus />
              Criar terminais
            </Button>
          </div>
      </div>
    </section>
  );
}

interface TerminalCountControlProps {
  icon: typeof Code2;
  label: string;
  description: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}

function TerminalCountControl({ icon: Icon, label, description, value, max, onChange }: TerminalCountControlProps) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-surface text-text">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">{label}</h3>
          <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="outline" size="icon" onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label={`Diminuir ${label}`}>
          <Minus />
        </Button>
        <div className="grid h-16 min-w-0 flex-1 place-items-center rounded-md border bg-surface">
          <span className="text-3xl font-semibold leading-none text-text">{value}</span>
        </div>
        <Button variant="outline" size="icon" onClick={() => onChange(value + 1)} disabled={max <= 0} aria-label={`Aumentar ${label}`}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}
