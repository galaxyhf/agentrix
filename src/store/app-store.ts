import { create } from "zustand";
import { DEFAULT_TEMPLATES, MODEL_COST_PER_1K, ROLE_PROMPTS } from "@/lib/constants";
import type { Agent, AgentModel, AgentRole, AgentrixSettings, ProviderConnection, SessionLog, TokenUsage, Workspace } from "@/lib/types";

const now = () => new Date().toISOString();
const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const emptyUsage: TokenUsage = {
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  estimated_cost: 0,
};

const defaultSettings: AgentrixSettings = {
  fontSize: 13,
  terminalRows: 28,
  terminalCols: 100,
  density: "comfortable",
  accent: "violet",
  transparency: false,
  animations: true,
  zoom: 100,
  cursorBlink: true,
  scrollback: 5000,
  defaultShell: "",
  copyOnSelect: true,
  pasteOnRightClick: true,
  ptyPerformance: "balanced",
  autoRestart: false,
  maxAgents: 6,
  agentTimeout: 45,
  defaultProjectsPath: "",
  autoSave: true,
  offlineSync: true,
  supabaseUrl: "",
  tokenLimit: 200000,
  costAlert: 25,
  dailyReset: true,
  updateChannel: "alpha",
  autoUpdate: false,
  debugMode: false,
  tauriEvents: true,
  backendLogLevel: "info",
};

const createAgent = (role: AgentRole, index: number): Agent => ({
  id: id(),
  name: `${role.charAt(0)}${role.slice(1).toLowerCase()} ${index}`,
  role,
  model: role === "RESEARCHER" ? "claude-code" : "codex",
  system_prompt: ROLE_PROMPTS[role],
  status: "idle",
  color: DEFAULT_TEMPLATES.find((template) => template.role === role)?.color ?? "accent",
  session_id: null,
  tokens: { ...emptyUsage },
});

const fallbackAgentId = "no-terminal-selected";

interface AppState {
  booted: boolean;
  authenticated: boolean;
  activeWorkspaceId: string;
  activeAgentId: string;
  settingsOpen: boolean;
  workspaces: Workspace[];
  agents: Agent[];
  connections: ProviderConnection[];
  logs: SessionLog[];
  settings: AgentrixSettings;
  setAuthenticated: (authenticated: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveAgent: (agentId: string) => void;
  addAgent: (role?: AgentRole) => void;
  removeAgent: (agentId: string) => void;
  updateAgent: (agentId: string, patch: Partial<Agent>) => void;
  attachSession: (agentId: string, sessionId: string) => void;
  detachSession: (agentId: string) => void;
  updateTokenUsage: (agentId: string, sessionId: string, usage: TokenUsage) => void;
  addLog: (agentId: string, level: SessionLog["level"], message: string) => void;
  updateSettings: (patch: Partial<AgentrixSettings>) => void;
  updateConnection: (provider: AgentModel, patch: Partial<ProviderConnection>) => void;
  clearCache: () => void;
  resetApp: () => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

const defaultWorkspace: Workspace = {
  id: id(),
  name: "Local Workspace",
  path: "",
  updatedAt: now(),
  synced: false,
};

const initialAgents = [createAgent("CODER", 1), createAgent("THINKER", 1), createAgent("REVIEWER", 1)];

async function readPersistedState() {
  const fallback = localStorage.getItem("agentrix-state");
  if (!window.__TAURI_INTERNALS__) {
    return fallback ? JSON.parse(fallback) : null;
  }

  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    const store = await Store.load("agentrix.json");
    return (await store.get("state")) ?? (fallback ? JSON.parse(fallback) : null);
  } catch {
    return fallback ? JSON.parse(fallback) : null;
  }
}

async function writePersistedState(state: Pick<AppState, "authenticated" | "activeWorkspaceId" | "activeAgentId" | "workspaces" | "agents" | "connections" | "logs" | "settings">) {
  localStorage.setItem("agentrix-state", JSON.stringify(state));

  if (!window.__TAURI_INTERNALS__) {
    return;
  }

  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    const store = await Store.load("agentrix.json");
    await store.set("state", state);
    await store.save();
  } catch {
    // localStorage remains the web preview fallback.
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  booted: false,
  authenticated: false,
  activeWorkspaceId: defaultWorkspace.id,
  activeAgentId: initialAgents[0].id,
  settingsOpen: false,
  workspaces: [defaultWorkspace],
  agents: initialAgents,
  connections: [
    { provider: "claude-code", connected: false },
    { provider: "codex", connected: false },
  ],
  logs: [],
  settings: defaultSettings,
  setAuthenticated: (authenticated) => {
    set({ authenticated });
    void get().save();
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setActiveAgent: (activeAgentId) => {
    set({ activeAgentId });
    void get().save();
  },
  addAgent: (role = "CODER") => {
    const state = get();
    if (state.agents.length >= state.settings.maxAgents) {
      state.addLog(state.activeAgentId, "warn", "Limite maximo de agentes simultaneos atingido.");
      return;
    }
    const agent = createAgent(role, state.agents.filter((item) => item.role === role).length + 1);
    set((current) => ({
      agents: [...current.agents, agent],
      activeAgentId: agent.id,
    }));
    void get().save();
  },
  removeAgent: (agentId) => {
    const state = get();
    const remaining = state.agents.filter((agent) => agent.id !== agentId);
    const nextActive = state.activeAgentId === agentId ? remaining[0]?.id ?? fallbackAgentId : state.activeAgentId;
    set({
      agents: remaining,
      activeAgentId: nextActive,
      logs: state.logs.filter((log) => log.agentId !== agentId),
    });
    void get().save();
  },
  updateAgent: (agentId, patch) => {
    set((state) => ({
      agents: state.agents.map((agent) => (agent.id === agentId ? { ...agent, ...patch } : agent)),
    }));
    void get().save();
  },
  attachSession: (agentId, sessionId) => {
    set((state) => ({
      agents: state.agents.map((agent) => (agent.id === agentId ? { ...agent, session_id: sessionId, status: "running" } : agent)),
    }));
    get().addLog(agentId, "info", `Sessao ${sessionId} conectada.`);
    void get().save();
  },
  detachSession: (agentId) => {
    set((state) => ({
      agents: state.agents.map((agent) => (agent.id === agentId ? { ...agent, session_id: null, status: "idle" } : agent)),
    }));
    void get().save();
  },
  updateTokenUsage: (agentId, sessionId, usage) => {
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === agentId && agent.session_id === sessionId
          ? {
              ...agent,
              tokens: {
                ...usage,
                estimated_cost: usage.estimated_cost || (usage.total_tokens / 1000) * MODEL_COST_PER_1K[agent.model],
              },
            }
          : agent,
      ),
    }));
    void get().save();
  },
  addLog: (agentId, level, message) => {
    set((state) => ({
      logs: [
        {
          id: id(),
          agentId,
          level,
          message,
          createdAt: now(),
        },
        ...state.logs,
      ].slice(0, 200),
    }));
  },
  updateSettings: (patch) => {
    set((state) => ({ settings: { ...state.settings, ...patch } }));
    void get().save();
  },
  updateConnection: (provider, patch) => {
    set((state) => ({
      connections: state.connections.map((connection) => (connection.provider === provider ? { ...connection, ...patch } : connection)),
    }));
    void get().save();
  },
  clearCache: () => {
    set((state) => ({
      logs: [],
      agents: state.agents.map((agent) => ({
        ...agent,
        tokens: { ...emptyUsage },
      })),
    }));
    void get().save();
  },
  resetApp: () => {
    localStorage.removeItem("agentrix-state");
    set({
      authenticated: false,
      activeWorkspaceId: defaultWorkspace.id,
      activeAgentId: initialAgents[0].id,
      settingsOpen: false,
      workspaces: [defaultWorkspace],
      agents: initialAgents.map((agent) => ({ ...agent, session_id: null, status: "idle" })),
      connections: [
        { provider: "claude-code", connected: false },
        { provider: "codex", connected: false },
      ],
      logs: [],
      settings: defaultSettings,
    });
    void get().save();
  },
  load: async () => {
    const persisted = await readPersistedState();
    if (persisted) {
      const agents = (persisted.agents ?? initialAgents).map((agent: Agent) => ({
        ...agent,
        session_id: null,
        status: "idle" as const,
      }));
      set({
        ...persisted,
        agents,
        activeAgentId: agents.some((agent: Agent) => agent.id === persisted.activeAgentId) ? persisted.activeAgentId : agents[0]?.id,
        settings: { ...defaultSettings, ...persisted.settings },
        booted: true,
      });
      return;
    }
    set({ booted: true });
  },
  save: async () => {
    const state = get();
    await writePersistedState({
      authenticated: state.authenticated,
      activeWorkspaceId: state.activeWorkspaceId,
      activeAgentId: state.activeAgentId,
      workspaces: state.workspaces,
      agents: state.agents,
      connections: state.connections,
      logs: state.logs,
      settings: state.settings,
    });
  },
}));
