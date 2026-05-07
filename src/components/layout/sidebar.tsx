import { Database, Plus, Settings, TerminalSquare, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { stopAgentSession } from "@/lib/tauri";
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
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const connections = useAppStore((state) => state.connections);
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);
  const addAgent = useAppStore((state) => state.addAgent);
  const removeAgent = useAppStore((state) => state.removeAgent);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);

  const totalTokens = agents.reduce(
    (sum, agent) => sum + agent.tokens.total_tokens,
    0,
  );
  const totalCost = agents.reduce(
    (sum, agent) => sum + agent.tokens.estimated_cost,
    0,
  );

  async function deleteAgent(agentId: string) {
    const agent = agents.find((item) => item.id === agentId);
    if (agent?.session_id && !agent.session_id.startsWith("preview-")) {
      await stopAgentSession(agent.session_id);
    }
    removeAgent(agentId);
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
        <Select value={activeWorkspaceId}>
          <SelectTrigger aria-label="Workspace selector">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((workspace) => (
              <SelectItem value={workspace.id} key={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Offline sync</span>
          <Badge variant={workspaces[0]?.synced ? "success" : "secondary"}>
            {workspaces[0]?.synced ? "synced" : "local"}
          </Badge>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase text-text-muted">Agentes</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => addAgent("CODER")}
                  aria-label="Novo agente"
                >
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Novo agente</TooltipContent>
            </Tooltip>
          </div>

          {agents.map((agent) => (
            <div
              key={agent.id}
              className={cn(
                "w-full rounded-md border bg-background p-3 transition-colors hover:bg-card",
                activeAgentId === agent.id && "border-accent bg-card",
              )}
            >
              <button
                className="w-full text-left"
                onClick={() => setActiveAgent(agent.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {agent.name}
                  </span>
                  <Badge variant={statusVariant[agent.status]}>
                    {agent.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                  <span>{ROLE_LABELS[agent.role]}</span>
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
                      onClick={() => void deleteAgent(agent.id)}
                      aria-label={`Excluir ${agent.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Excluir terminal</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
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
