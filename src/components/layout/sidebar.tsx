import { Bot, Database, FolderOpen, Plus, Settings, TerminalSquare, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isTauri, stopAgentSession } from "@/lib/tauri";
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
  const connections = useAppStore((state) => state.connections);
  const settings = useAppStore((state) => state.settings);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const removeWorkspace = useAppStore((state) => state.removeWorkspace);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);

  const totalTokens = agents.reduce(
    (sum, agent) => sum + agent.tokens.total_tokens,
    0,
  );
  const totalCost = agents.reduce(
    (sum, agent) => sum + agent.tokens.estimated_cost,
    0,
  );

  function agentForWorkspace(workspaceId: string) {
    return agents.find((agent) => agent.workspace_id === workspaceId);
  }

  async function deleteWorkspace(workspaceId: string) {
    const workspaceAgents = agents.filter((agent) => agent.workspace_id === workspaceId);
    for (const agent of workspaceAgents) {
      if (agent.session_id && !agent.session_id.startsWith("preview-")) {
        await stopAgentSession(agent.session_id);
      }
    }
    removeWorkspace(workspaceId);
  }

  async function chooseProjectFolder() {
    if (!isTauri()) {
      return;
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Selecionar pasta do projeto",
    });
    if (typeof selected === "string") {
      updateSettings({ defaultProjectsPath: selected });
    }
  }

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r bg-surface">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <TerminalSquare className="size-5 text-accent" />
          <div>
            <h1 className="text-lg font-semibold leading-none">AGENTRIX</h1>
            <p className="mt-1 text-xs text-text-muted">v0.1.0</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-b p-3">
        <Button className="w-full" variant="outline" onClick={() => void chooseProjectFolder()} disabled={!isTauri()}>
          <FolderOpen />
          Pasta do projeto
        </Button>
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs text-text-muted">Projeto selecionado</p>
          <p className="mt-1 truncate text-xs text-text">{settings.defaultProjectsPath || "Nenhuma pasta selecionada"}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => addWorkspace("codex")} disabled={!settings.defaultProjectsPath}>
            <Plus />
            Codex
          </Button>
          <Button onClick={() => addWorkspace("claude-code")} disabled={!settings.defaultProjectsPath}>
            <Bot />
            Claude
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Workspaces ativos</span>
          <Badge variant="secondary">{workspaces.length}</Badge>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          <p className="mb-2 text-xs uppercase text-text-muted">Workspaces</p>

          {workspaces.length === 0 && (
            <div className="rounded-md border bg-background p-3 text-xs text-text-muted">
              Selecione uma pasta para abrir um terminal dentro dela.
            </div>
          )}

          {workspaces.map((workspace) => {
            const agent = agentForWorkspace(workspace.id);
            return (
            <div
              key={workspace.id}
              className={cn(
                "w-full rounded-md border bg-background p-3 transition-colors hover:bg-card",
                activeWorkspaceId === workspace.id && "border-accent bg-card",
              )}
            >
              <button
                className="w-full text-left"
                onClick={() => setActiveWorkspace(workspace.id)}
              >
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
                  <span>{agent?.model === "claude-code" ? "Claude" : "Codex"}</span>
                  <span>terminal</span>
                </div>
              </button>
              <div className="mt-3 flex justify-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => void deleteWorkspace(workspace.id)}
                      aria-label={`Excluir ${workspace.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Excluir terminal</TooltipContent>
                </Tooltip>
              </div>
            </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <div className="rounded-md border bg-background p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-text-muted">Tokens</span>
            <span>{totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Custo</span>
            <span>${totalCost.toFixed(4)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <Database className="size-3.5" />
            <span>
              {connections.filter((connection) => connection.connected).length}
              /2 CLIs
            </span>
          </div>
          <Badge variant="secondary">local</Badge>
        </div>

        <Separator className="my-3" />

        <div className="flex justify-end">
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
      </div>
    </aside>
  );
}
