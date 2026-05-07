import { TerminalPane } from "@/components/terminal/terminal-pane";
import { useAppStore } from "@/store/app-store";

export function MainWorkspace() {
  const agents = useAppStore((state) => state.agents);
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);

  const columns = agents.length <= 1 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(agents.length / columns));

  if (agents.length === 0) {
    return (
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <section className="grid min-h-0 flex-1 place-items-center bg-terminal-bg p-8">
          <div className="max-w-sm text-center">
            <h2 className="text-sm font-medium text-text">
              Nenhum workspace aberto
            </h2>
            <p className="mt-2 text-xs text-text-muted">
              Selecione a pasta do projeto na sidebar e crie um workspace Codex ou Claude. Cada workspace abrira um terminal nessa pasta e iniciara o CLI escolhido.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-background">
      <section
        className="grid min-h-0 flex-1 gap-px overflow-hidden bg-border p-px"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="min-h-0 min-w-0 overflow-hidden"
            onClick={() => setActiveAgent(agent.id)}
          >
            <TerminalPane agent={agent} />
          </div>
        ))}
      </section>
    </main>
  );
}
