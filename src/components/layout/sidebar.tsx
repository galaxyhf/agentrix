import { Bot, Code2, FolderOpen, Plus, Settings, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { AgentStatus } from "@/lib/types";

const statusVariant: Record<
  AgentStatus,
  "secondary" | "success" | "error" | "default"
> = {
  idle: "secondary",
  running: "success",
  waiting: "default",
  error: "error",
};

const statusLabel: Record<AgentStatus, string> = {
  idle: "idle",
  running: "running",
  waiting: "ready",
  error: "error",
};

export function Sidebar() {
  const workspaces = useAppStore((state) => state.workspaces);
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const agents = useAppStore((state) => state.agents);
  const settings = useAppStore((state) => state.settings);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const removeWorkspace = useAppStore((state) => state.removeWorkspace);
  const removeAllWorkspaces = useAppStore((state) => state.removeAllWorkspaces);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);

  function agentForWorkspace(workspaceId: string) {
    return agents.find((agent) => agent.workspace_id === workspaceId);
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

  async function createWorkspace(provider: "codex" | "claude-code") {
    if (settings.defaultProjectsPath) {
      addWorkspace(provider);
      return;
    }

    const selected = await chooseProjectFolder();
    if (selected) {
      useAppStore.getState().addWorkspace(provider);
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-surface">
      <div className="border-b p-3">
        <div>
          <h1 className="text-lg font-semibold leading-none">AGENTRIX</h1>
          <p className="mt-1 text-xs text-text-muted">v0.2.0</p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-3 py-3 pr-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 rounded-md border bg-background/80 px-2 py-1.5 text-xs font-semibold text-text">
              <span className="size-2 shrink-0 rounded-full bg-accent shadow-[0_0_10px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]" />
              <span className="truncate">
                {settings.defaultProjectsPath
                  ? folderNameFromPath(settings.defaultProjectsPath)
                  : "Nenhuma pasta selecionada"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => void createWorkspace("codex")}
                    aria-label="Novo Codex"
                  >
                    <Plus />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Novo Codex</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => void createWorkspace("claude-code")}
                    aria-label="Novo Claude"
                  >
                    <Bot />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Novo Claude</TooltipContent>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => void chooseProjectFolder()}
                    aria-label="Selecionar pasta do projeto"
                  >
                    <FolderOpen />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Selecionar pasta</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {workspaces.length === 0 && (
            <div className="rounded-md border bg-background p-3 text-xs text-text-muted">
              Selecione uma pasta no botao acima. Os workspaces serao criados
              dentro dela.
            </div>
          )}

          {workspaces.map((workspace) => {
            const agent = agentForWorkspace(workspace.id);
            const status = agent?.status ?? "idle";
            const isActive = activeWorkspaceId === workspace.id;
            const isClaude = agent?.model === "claude-code";
            const ProviderIcon = isClaude ? Bot : Code2;
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
                  "group flex min-h-[108px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-lg border bg-background/80 p-3 transition-colors hover:border-accent/70 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                  isActive && "border-accent bg-card ring-1 ring-inset ring-accent",
                )}
              >
                <div className="w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-5 text-text">
                        {workspace.name}
                      </span>
                      <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                        <span className="grid size-6 shrink-0 place-items-center rounded-md border bg-surface text-text">
                          <ProviderIcon className="size-3.5" />
                        </span>
                        <span className="truncate whitespace-nowrap">
                          {isClaude ? "Claude Code" : "Codex"}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={statusVariant[status]}
                      className="h-6 w-[5.75rem] shrink-0 justify-center gap-1.5 px-2"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full bg-current",
                          status === "running" && "animate-pulse",
                        )}
                      />
                      <span className="truncate">{statusLabel[status]}</span>
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex h-7 justify-end">
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
        <span>v0.1.0</span>
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
      </div>
    </aside>
  );
}

function folderNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}
