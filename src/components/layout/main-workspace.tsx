import { useState } from "react";
import { Bot, Code2, FolderOpen, Minus, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TerminalPane } from "@/components/terminal/terminal-pane";
import type { AgentModel } from "@/lib/types";
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
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const activeWorkspaceAgents = activeWorkspace ? allAgents.filter((agent) => agent.workspace_id === activeWorkspace.id) : [];
  const visibleAgentId = activeWorkspaceAgents.some((agent) => agent.id === activeAgentId) ? activeAgentId : activeWorkspaceAgents[0]?.id;
  const isGridLayout = settings.workspaceLayout === "grid";

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
        <WorkspaceSetup workspaceName={activeWorkspace.name} workspacePath={activeWorkspace.path} onStart={(provider, count) => configureWorkspace(activeWorkspace.id, provider, count)} />
      </main>
    );
  }

  return (
    <main
      className={cn(
        "relative min-w-0 flex-1 overflow-hidden bg-background",
        isGridLayout
          ? "grid gap-2 p-2"
          : "relative",
        isGridLayout && activeWorkspaceAgents.length <= 1 && "grid-cols-1",
        isGridLayout && activeWorkspaceAgents.length === 2 && "grid-cols-2",
        isGridLayout && activeWorkspaceAgents.length >= 3 && activeWorkspaceAgents.length <= 4 && "grid-cols-2 grid-rows-2",
        isGridLayout && activeWorkspaceAgents.length >= 5 && "grid-cols-3 grid-rows-2",
      )}
    >
      {activeWorkspaceAgents.map((agent) => {
        const isVisible = isGridLayout || agent.id === visibleAgentId;
        return (
          <section
            key={agent.id}
            className={cn(
              "min-h-0 min-w-0 overflow-hidden bg-terminal-bg",
              isGridLayout
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
            <TerminalPane agent={agent} visible={isVisible} />
          </section>
        );
      })}
    </main>
  );
}

interface WorkspaceSetupProps {
  workspaceName: string;
  workspacePath: string;
  onStart: (provider: AgentModel, count: number) => void;
}

function WorkspaceSetup({ workspaceName, workspacePath, onStart }: WorkspaceSetupProps) {
  const settings = useAppStore((state) => state.settings);
  const saveWorkspaceProfile = useAppStore((state) => state.saveWorkspaceProfile);
  const availableSlots = settings.maxAgents;
  const [provider, setProvider] = useState<AgentModel>("codex");
  const [terminalCount, setTerminalCount] = useState(Math.min(2, Math.max(1, availableSlots)));
  const [profileName, setProfileName] = useState("");
  const count = Math.min(terminalCount, Math.max(1, availableSlots));
  const canCreateTerminals = availableSlots > 0;
  const profiles = settings.workspaceProfiles;

  function updateCount(next: number) {
    setTerminalCount(Math.min(availableSlots, Math.max(1, next)));
  }

  function saveProfile() {
    saveWorkspaceProfile({
      name: profileName,
      provider,
      terminalCount: count,
    });
    setProfileName("");
  }

  function applyProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }
    setProvider(profile.provider);
    setTerminalCount(profile.terminalCount);
    onStart(profile.provider, profile.terminalCount);
  }

  return (
    <section className="relative z-10 flex h-full min-h-0 flex-col bg-terminal-bg px-8 py-7">
      <div className="mx-auto flex h-full max-w-4xl flex-col justify-center">
        <div className="mb-7">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">Configurar workspace</p>
          <h2 className="mt-2 text-2xl font-semibold text-text">{workspaceName}</h2>
          <p className="mt-2 max-w-2xl truncate text-xs text-text-muted">{workspacePath}</p>
        </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-md border bg-background p-4">
              <h3 className="text-sm font-semibold text-text">CLI inicial</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ProviderButton
                  active={provider === "codex"}
                  icon={Code2}
                  label="Codex"
                  description="Abre cada terminal ja chamando o Codex CLI."
                  onClick={() => setProvider("codex")}
                />
                <ProviderButton
                  active={provider === "claude-code"}
                  icon={Bot}
                  label="Claude Code"
                  description="Abre cada terminal ja chamando o Claude Code CLI."
                  onClick={() => setProvider("claude-code")}
                />
              </div>
            </section>

            <section className="rounded-md border bg-background p-4">
              <h3 className="text-sm font-semibold text-text">Terminais</h3>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Button variant="outline" size="icon" onClick={() => updateCount(count - 1)} disabled={count <= 1} aria-label="Diminuir terminais">
                  <Minus />
                </Button>
                <div className="grid h-16 min-w-0 flex-1 place-items-center rounded-md border bg-surface">
                  <span className="text-3xl font-semibold leading-none text-text">{count}</span>
                </div>
                <Button variant="outline" size="icon" onClick={() => updateCount(count + 1)} disabled={!canCreateTerminals || count >= availableSlots} aria-label="Aumentar terminais">
                  <Plus />
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-text-muted">
                Limite disponivel neste app: {availableSlots} {availableSlots === 1 ? "terminal" : "terminais"}.
              </p>
            </section>
          </div>

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
                        {profile.name} · {providerLabel(profile.provider)} · {profile.terminalCount}
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
            <Button onClick={() => onStart(provider, count)} disabled={!canCreateTerminals} className="gap-2">
              {provider === "claude-code" ? <Bot /> : <Code2 />}
              Criar terminais
            </Button>
          </div>
      </div>
    </section>
  );
}

function providerLabel(provider: AgentModel) {
  return provider === "claude-code" ? "Claude Code" : "Codex";
}

interface ProviderButtonProps {
  active: boolean;
  icon: typeof Code2;
  label: string;
  description: string;
  onClick: () => void;
}

function ProviderButton({ active, icon: Icon, label, description, onClick }: ProviderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[104px] items-start gap-3 rounded-md border bg-surface p-3 text-left transition-colors hover:border-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
        active && "border-accent bg-card ring-1 ring-inset ring-accent",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background text-text">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-text-muted">{description}</span>
      </span>
    </button>
  );
}
