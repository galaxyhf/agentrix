import { TerminalPane } from "@/components/terminal/terminal-pane";
import { useAppStore } from "@/store/app-store";

export function MainWorkspace() {
  const agents = useAppStore((state) => state.agents);
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const visibleAgentId = agents.some((agent) => agent.id === activeAgentId) ? activeAgentId : agents[0]?.id;

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
    <main className="relative min-w-0 flex-1 overflow-hidden bg-background">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className={
            agent.id === visibleAgentId
              ? "visible absolute inset-0 z-10 opacity-100"
              : "invisible pointer-events-none absolute inset-0 z-0 opacity-0"
          }
          aria-hidden={agent.id !== visibleAgentId}
        >
          <TerminalPane agent={agent} visible={agent.id === visibleAgentId} />
        </div>
      ))}
    </main>
  );
}
