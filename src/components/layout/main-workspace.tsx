import { useState } from "react";
import { Bot, Code2, FolderOpen, Grid3X3, Minus, Pencil, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
        <WorkspaceSetup workspaceName={activeWorkspace.name} workspacePath={activeWorkspace.path} onStart={(codexCount, claudeCount, geminiCount, codexYoloMode) => configureWorkspace(activeWorkspace.id, codexCount, claudeCount, geminiCount, undefined, codexYoloMode)} />
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
  onStart: (codexCount: number, claudeCount: number, geminiCount: number, codexYoloMode: boolean) => void;
}

function WorkspaceSetup({ workspaceName, workspacePath, onStart }: WorkspaceSetupProps) {
  const settings = useAppStore((state) => state.settings);
  const saveWorkspaceProfile = useAppStore((state) => state.saveWorkspaceProfile);
  const removeWorkspaceProfile = useAppStore((state) => state.removeWorkspaceProfile);
  const availableSlots = settings.maxAgents;
  const [codexCount, setCodexCount] = useState(availableSlots >= 2 ? 1 : Math.min(1, availableSlots));
  const [claudeCount, setClaudeCount] = useState(availableSlots >= 2 ? 1 : 0);
  const [geminiCount, setGeminiCount] = useState(0);
  const [codexYoloMode, setCodexYoloMode] = useState(settings.codexYoloMode);
  const [profileName, setProfileName] = useState("");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const totalCount = codexCount + claudeCount + geminiCount;
  const canCreateTerminals = totalCount > 0;
  const profiles = settings.workspaceProfiles;

  function updateCodexCount(next: number) {
    const normalized = Math.min(Math.max(0, next), Math.max(0, availableSlots - claudeCount - geminiCount));
    setCodexCount(normalized);
  }

  function updateClaudeCount(next: number) {
    const normalized = Math.min(Math.max(0, next), Math.max(0, availableSlots - codexCount - geminiCount));
    setClaudeCount(normalized);
  }

  function updateGeminiCount(next: number) {
    const normalized = Math.min(Math.max(0, next), Math.max(0, availableSlots - codexCount - claudeCount));
    setGeminiCount(normalized);
  }

  function saveProfile() {
    saveWorkspaceProfile({
      id: editingProfileId ?? undefined,
      name: profileName,
      codexCount,
      claudeCount,
      geminiCount,
    });
    setProfileName("");
    setEditingProfileId(null);
  }

  function applyProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }
    const nextCodexCount = Math.min(profile.codexCount, availableSlots);
    const nextClaudeCount = Math.min(profile.claudeCount, Math.max(0, availableSlots - nextCodexCount));
    const nextGeminiCount = Math.min(profile.geminiCount, Math.max(0, availableSlots - nextCodexCount - nextClaudeCount));
    setCodexCount(nextCodexCount);
    setClaudeCount(nextClaudeCount);
    setGeminiCount(nextGeminiCount);
    setSelectedProfileId(profile.id);
    onStart(nextCodexCount, nextClaudeCount, nextGeminiCount, nextCodexCount > 0 && codexYoloMode);
  }

  function editProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }
    setEditingProfileId(profile.id);
    setProfileName(profile.name);
    setCodexCount(Math.min(profile.codexCount, availableSlots));
    setClaudeCount(Math.min(profile.claudeCount, Math.max(0, availableSlots - profile.codexCount)));
    setGeminiCount(Math.min(profile.geminiCount, Math.max(0, availableSlots - profile.codexCount - profile.claudeCount)));
  }

  return (
    <section className="relative z-10 flex h-full min-h-0 flex-col bg-terminal-bg px-8 py-7">
      <div className="mx-auto flex h-full max-w-4xl flex-col justify-center">
        <div className="mb-7">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">Configurar workspace</p>
          <h2 className="mt-2 text-2xl font-semibold text-text">{workspaceName}</h2>
          <p className="mt-2 max-w-2xl truncate text-xs text-text-muted">{workspacePath}</p>
        </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-md border bg-background p-4">
              <TerminalCountControl
                icon={Code2}
                label="Codex"
                description="Terminais que abrem direto no Codex CLI."
                value={codexCount}
                max={availableSlots - claudeCount - geminiCount}
                onChange={updateCodexCount}
              />
            </section>

            <section className="rounded-md border bg-background p-4">
              <TerminalCountControl
                icon={Bot}
                label="Claude Code"
                description="Terminais que abrem direto no Claude Code CLI."
                value={claudeCount}
                max={availableSlots - codexCount - geminiCount}
                onChange={updateClaudeCount}
              />
            </section>

            <section className="rounded-md border bg-background p-4">
              <TerminalCountControl
                icon={Sparkles}
                label="Gemini CLI"
                description="Terminais que abrem direto no Gemini CLI."
                value={geminiCount}
                max={availableSlots - codexCount - claudeCount}
                onChange={updateGeminiCount}
              />
            </section>
          </div>

          <p className="mt-3 text-xs leading-5 text-text-muted">
            Total: {totalCount} de {availableSlots} {availableSlots === 1 ? "terminal" : "terminais"} neste workspace.
          </p>

          <section className="mt-4 flex items-center justify-between gap-4 rounded-md border bg-background p-4">
            <div className="min-w-0">
              <Label htmlFor="codex-yolo-mode">Iniciar o Codex no YOLO mode?</Label>
              <p className="mt-1 text-xs leading-5 text-text-muted">Desativa pedidos de aprovacao e sandbox nos terminais Codex criados agora.</p>
            </div>
            <Switch id="codex-yolo-mode" checked={codexYoloMode} disabled={codexCount === 0} onCheckedChange={setCodexYoloMode} />
          </section>

          <section className="mt-4 rounded-md border bg-background p-4">
            <div className="grid gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Perfis</h3>
                  <span className="text-xs text-text-muted">{profiles.length}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-text-muted">
                  Salve a combinacao atual ou selecione um perfil para criar os terminais agora.
                </p>
              </div>

              {profiles.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {profiles.map((profile) => {
                    const isSelected = selectedProfileId === profile.id;
                    return (
                      <div
                        key={profile.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => applyProfile(profile.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            applyProfile(profile.id);
                          }
                        }}
                        className={cn(
                          "group flex h-20 min-w-0 cursor-pointer items-center gap-3 rounded-md border bg-surface/70 px-3 text-left transition-colors hover:border-accent/70 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                          isSelected && "border-accent bg-card ring-1 ring-inset ring-accent",
                        )}
                        aria-label={`Usar perfil ${profile.name}`}
                      >
                        <span className="grid size-11 shrink-0 place-items-center rounded-md border bg-background text-text-muted">
                          <Grid3X3 className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text">{profile.name}</p>
                          <p className="mt-1 truncate text-xs text-text-muted">{profileSummary(profile.codexCount, profile.claudeCount, profile.geminiCount)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={(event) => {
                              event.stopPropagation();
                              editProfile(profile.id);
                            }}
                            aria-label={`Editar ${profile.name}`}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeWorkspaceProfile(profile.id);
                              if (selectedProfileId === profile.id) {
                                setSelectedProfileId(null);
                              }
                              if (editingProfileId === profile.id) {
                                setEditingProfileId(null);
                                setProfileName("");
                              }
                            }}
                            aria-label={`Excluir ${profile.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex min-w-0 gap-2">
                <Input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder={editingProfileId ? "Renomear perfil" : "Nome do perfil"}
                  className="min-w-0"
                />
                <Button variant="outline" size="icon" onClick={saveProfile} disabled={!profileName.trim()} aria-label={editingProfileId ? "Atualizar perfil" : "Salvar perfil"}>
                  <Save />
                </Button>
              </div>
            </div>
          </section>

          <div className="mt-5 flex justify-end">
            <Button onClick={() => onStart(codexCount, claudeCount, geminiCount, codexCount > 0 && codexYoloMode)} disabled={!canCreateTerminals} className="gap-2">
              <Plus />
              Criar terminais
            </Button>
          </div>
      </div>
    </section>
  );
}

function profileSummary(codexCount: number, claudeCount: number, geminiCount: number) {
  const parts = [];
  if (codexCount > 0) {
    parts.push(`Codex ${codexCount}`);
  }
  if (claudeCount > 0) {
    parts.push(`Claude ${claudeCount}`);
  }
  if (geminiCount > 0) {
    parts.push(`Gemini ${geminiCount}`);
  }
  return parts.join(" / ");
}

interface TerminalCountControlProps {
  icon: LucideIcon;
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
        <Button variant="outline" size="icon" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Aumentar ${label}`}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}
