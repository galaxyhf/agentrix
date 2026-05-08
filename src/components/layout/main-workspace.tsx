import { TerminalPane } from "@/components/terminal/terminal-pane";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

export function MainWorkspace() {
  const agents = useAppStore((state) => state.agents);
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const settings = useAppStore((state) => state.settings);
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);
  const visibleAgentId = agents.some((agent) => agent.id === activeAgentId) ? activeAgentId : agents[0]?.id;
  const isGridLayout = settings.workspaceLayout === "grid";

  if (agents.length === 0) {
    return (
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <section className="grid min-h-0 flex-1 place-items-center bg-terminal-bg p-8">
          <div className="max-w-sm text-center">
            <h2 className="text-sm font-medium text-text">
              Nenhum workspace aberto
            </h2>
            <p className="mt-2 text-xs text-text-muted">
              Selecione a pasta do projeto na sidebar e crie um workspace Codex ou Claude. Cada workspace abrira o CLI escolhido em um terminal isolado.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "min-w-0 flex-1 overflow-hidden bg-background",
        isGridLayout
          ? "grid gap-2 p-2"
          : "relative",
        isGridLayout && agents.length <= 1 && "grid-cols-1",
        isGridLayout && agents.length === 2 && "grid-cols-2",
        isGridLayout && agents.length >= 3 && agents.length <= 4 && "grid-cols-2 grid-rows-2",
        isGridLayout && agents.length >= 5 && "grid-cols-3 grid-rows-2",
      )}
    >
      {agents.map((agent) => (
        <section
          key={agent.id}
          className={cn(
            "min-h-0 min-w-0 overflow-hidden bg-terminal-bg",
            isGridLayout
              ? "relative rounded-md border"
              : agent.id === visibleAgentId
                ? "visible absolute inset-0 z-10 opacity-100"
                : "invisible pointer-events-none absolute inset-0 z-0 opacity-0",
            isGridLayout && agent.id === visibleAgentId && "border-accent ring-1 ring-inset ring-accent",
          )}
          aria-hidden={!isGridLayout && agent.id !== visibleAgentId}
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
          <TerminalPane agent={agent} visible={isGridLayout || agent.id === visibleAgentId} />
        </section>
      ))}
    </main>
  );
}
