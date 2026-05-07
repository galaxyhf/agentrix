import { TerminalPane } from "@/components/terminal/terminal-pane";
import { useAppStore } from "@/store/app-store";

export function MainWorkspace() {
  const agents = useAppStore((state) => state.agents);
  const activeAgentId = useAppStore((state) => state.activeAgentId);
  const setActiveAgent = useAppStore((state) => state.setActiveAgent);

  const activeAgent = agents.find((agent) => agent.id === activeAgentId) ?? agents[0];
  const columns = Math.max(1, Math.ceil(Math.sqrt(agents.length)));
  const rows = Math.max(1, Math.ceil(agents.length / columns));

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
