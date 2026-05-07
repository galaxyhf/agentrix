import { Bot, FolderOpen, Plus, Settings, Trash2 } from "lucide-react";
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
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-surface">
      <div className="border-b p-3">
        <div>
          <h1 className="text-lg font-semibold leading-none">AGENTRIX</h1>
          <p className="mt-1 text-xs text-text-muted">v0.2.0</p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-medium text-text">
              {settings.defaultProjectsPath
                ? folderNameFromPath(settings.defaultProjectsPath)
                : "Nenhuma pasta selecionada"}
            </p>
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
                  "w-full cursor-pointer rounded-md border bg-background p-3 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  activeWorkspaceId === workspace.id && "border-accent bg-card",
                )}
              >
                <div className="w-full text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {workspace.name}
                    </span>
                    <Badge variant={statusVariant[agent?.status ?? "idle"]}>
                      {agent?.status ?? "idle"}
                    </Badge>
                  </div>
                  <p className="mt-2 truncate text-xs text-text-muted">
                    {workspace.path}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                    <span>
                      {agent?.model === "claude-code" ? "Claude" : "Codex"}
                    </span>
                    <span>terminal</span>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
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
