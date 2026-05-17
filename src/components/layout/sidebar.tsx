import { Bot, Code2, PanelLeftClose, PanelLeftOpen, Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { stopAgentSession } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
export function Sidebar() {
  const workspaces = useAppStore((state) => state.workspaces);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const agents = useAppStore((state) => state.agents);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const removeWorkspace = useAppStore((state) => state.removeWorkspace);
  const removeAllWorkspaces = useAppStore((state) => state.removeAllWorkspaces);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const sidebarCollapsed = useAppStore((state) => state.settings.sidebarCollapsed);

  function agentsForWorkspace(workspaceId: string) {
    return agents.filter((agent) => agent.workspace_id === workspaceId);
  }

  async function deleteWorkspace(workspaceId: string) {
    const workspaceAgents = agents.filter(
      (agent) => agent.workspace_id === workspaceId,
    );
    for (const agent of workspaceAgents) {
      if (agent.session_id && !agent.session_id.startsWith("preview-")) {
        await stopAgentSession(agent.session_id);
      }
    }
    removeWorkspace(workspaceId);
  }

  async function deleteAllWorkspaces() {
    for (const agent of agents) {
      if (agent.session_id && !agent.session_id.startsWith("preview-")) {
        await stopAgentSession(agent.session_id);
      }
    }
    removeAllWorkspaces();
  }

  async function chooseProjectFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Selecionar pasta do projeto",
      });
      if (typeof selected === "string") {
        updateSettings({ defaultProjectsPath: selected });
        return selected;
      }
    } catch {
      return null;
    }
    return null;
  }

  async function createWorkspace() {
    const selected = await chooseProjectFolder();
    if (selected) {
      useAppStore.getState().addWorkspace(selected);
    }
  }

  if (sidebarCollapsed) {
    return (
      <aside className="flex h-full w-16 shrink-0 flex-col border-r bg-surface transition-[width] duration-200 ease-out">
        <div className="grid h-18.5 place-items-center border-b">
          <span className="text-lg font-semibold leading-none">A</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2 px-2 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="size-9"
                onClick={() => void createWorkspace()}
                aria-label="Novo workspace"
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Novo workspace</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-col items-end gap-2 border-t p-2 text-xs text-text-muted">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
              >
                <Settings />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => updateSettings({ sidebarCollapsed: false })}
                aria-label="Expandir sidebar"
              >
                <PanelLeftOpen />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir sidebar</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r bg-surface transition-[width] duration-200 ease-out">
      <div className="border-b p-3">
        <div>
          <h1 className="text-lg font-semibold leading-none">AGENTRIX</h1>
          <p className="mt-1 text-xs text-text-muted">v0.2.0</p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-3 py-3 pr-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-text-muted">
                Workspaces
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => void createWorkspace()}
                    aria-label="Novo workspace"
                  >
                    <Plus />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Novo workspace</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => void deleteAllWorkspaces()}
                    disabled={workspaces.length === 0}
                    aria-label="Excluir todos"
                  >
                    <Trash2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Excluir todos</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {workspaces.length === 0 && (
            <div className="rounded-md border bg-background p-3 text-xs text-text-muted">
              Crie um workspace selecionando a pasta do projeto.
            </div>
          )}

          {workspaces.map((workspace) => {
            const workspaceAgents = agentsForWorkspace(workspace.id);
            const activeAgents = workspaceAgents.filter(
              (agent) => agent.status === "running",
            );
            const errorAgents = workspaceAgents.filter(
              (agent) => agent.status === "error",
            );
            const status =
              errorAgents[0]?.status ??
              activeAgents[0]?.status ??
              workspaceAgents[0]?.status ??
              "idle";
            const isActive = activeWorkspaceId === workspace.id;
            const codexCount = workspaceAgents.filter(
              (agent) => agent.model === "codex",
            ).length;
            const claudeCount = workspaceAgents.filter(
              (agent) => agent.model === "claude-code",
            ).length;
            const ProviderIcon = claudeCount > codexCount ? Bot : Code2;
            const providerLabel =
              workspaceAgents.length === 0
                ? "Configurar"
                : claudeCount > 0 && codexCount > 0
                  ? `Codex ${codexCount} / Claude ${claudeCount}`
                  : claudeCount > 0
                    ? "Claude Code"
                    : "Codex";
            const terminalLabel =
              workspaceAgents.length === 0
                ? "sem terminais"
                : `${workspaceAgents.length} ${workspaceAgents.length === 1 ? "terminal" : "terminais"}`;
            return (
              <div
                key={workspace.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveWorkspace(workspace.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveWorkspace(workspace.id);
                  }
                }}
                className={cn(
                  "group flex min-h-[96px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-lg border bg-background/80 px-3 py-2.5 transition-colors hover:border-accent/70 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                  isActive &&
                    "border-accent bg-card ring-1 ring-inset ring-accent",
                )}
              >
                <div className="w-full min-w-0 text-left">
                  <span className="block truncate text-sm font-semibold leading-5 text-text">
                    {workspace.name}
                  </span>
                  <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-text-muted">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md border bg-surface text-text">
                      <ProviderIcon className="size-3.5" />
                    </span>
                    <span className="min-w-0 truncate whitespace-nowrap">
                      {providerLabel}
                    </span>
                    <span className="shrink-0 text-text-muted/70">·</span>
                    <span className="min-w-0 truncate whitespace-nowrap">
                      {terminalLabel}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex h-7 items-center justify-between gap-2 pr-0.5">
                  <div
                    className={cn(
                      "flex h-6 min-w-[5.5rem] shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em]",
                      status === "error"
                        ? "border-error/50 bg-error/10 text-error"
                        : status === "running"
                          ? "border-success/50 bg-success/10 text-success"
                          : "border-border bg-surface text-text-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full bg-current",
                        status === "running" && "animate-pulse",
                      )}
                    />
                    <span className="truncate">
                      {status === "running"
                        ? "running"
                        : status === "waiting"
                          ? "ready"
                          : status}
                    </span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-text-muted opacity-70 transition-opacity hover:opacity-100 group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteWorkspace(workspace.id);
                        }}
                        aria-label={`Excluir ${workspace.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Excluir workspace</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between border-t p-3 text-xs text-text-muted">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <Settings />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateSettings({ sidebarCollapsed: true })}
              aria-label="Recolher sidebar"
            >
              <PanelLeftClose />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Recolher sidebar</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
