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
  density: "comfortable",
  accent: "violet",
  zoom: 100,
  cursorBlink: true,
  defaultShell: "",
  pasteOnRightClick: true,
  workspaceLayout: "single",
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

function normalizeSettings(settings: Partial<AgentrixSettings> | undefined): AgentrixSettings {
  return {
    fontSize: settings?.fontSize ?? defaultSettings.fontSize,
    density: settings?.density ?? defaultSettings.density,
    accent: settings?.accent ?? defaultSettings.accent,
    zoom: settings?.zoom ?? defaultSettings.zoom,
    cursorBlink: settings?.cursorBlink ?? defaultSettings.cursorBlink,
    defaultShell: settings?.defaultShell ?? defaultSettings.defaultShell,
    pasteOnRightClick: settings?.pasteOnRightClick ?? defaultSettings.pasteOnRightClick,
    workspaceLayout: settings?.workspaceLayout ?? defaultSettings.workspaceLayout,
    autoRestart: settings?.autoRestart ?? defaultSettings.autoRestart,
    maxAgents: settings?.maxAgents ?? defaultSettings.maxAgents,
    agentTimeout: settings?.agentTimeout ?? defaultSettings.agentTimeout,
    defaultProjectsPath: settings?.defaultProjectsPath ?? defaultSettings.defaultProjectsPath,
    autoSave: settings?.autoSave ?? defaultSettings.autoSave,
    offlineSync: settings?.offlineSync ?? defaultSettings.offlineSync,
    supabaseUrl: settings?.supabaseUrl ?? defaultSettings.supabaseUrl,
    tokenLimit: settings?.tokenLimit ?? defaultSettings.tokenLimit,
    costAlert: settings?.costAlert ?? defaultSettings.costAlert,
    dailyReset: settings?.dailyReset ?? defaultSettings.dailyReset,
    updateChannel: settings?.updateChannel ?? defaultSettings.updateChannel,
    autoUpdate: settings?.autoUpdate ?? defaultSettings.autoUpdate,
    debugMode: settings?.debugMode ?? defaultSettings.debugMode,
    tauriEvents: settings?.tauriEvents ?? defaultSettings.tauriEvents,
    backendLogLevel: settings?.backendLogLevel ?? defaultSettings.backendLogLevel,
  };
}

const createAgent = (role: AgentRole, index: number, workspaceId: string | null = null, name?: string): Agent => ({
  id: id(),
  workspace_id: workspaceId,
  name: name ?? `${role.charAt(0)}${role.slice(1).toLowerCase()} ${index}`,
  role,
  model: role === "RESEARCHER" ? "claude-code" : "codex",
  system_prompt: ROLE_PROMPTS[role],
  status: "idle",
  color: DEFAULT_TEMPLATES.find((template) => template.role === role)?.color ?? "accent",
  session_id: null,
  tokens: { ...emptyUsage },
  pending_command: null,
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
  setActiveWorkspace: (workspaceId: string) => void;
  setActiveWorkspacePath: (path: string) => void;
  addWorkspace: (provider: AgentModel, pendingCommand?: string, name?: string) => void;
  removeWorkspace: (workspaceId: string) => void;
  removeAllWorkspaces: () => void;
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

const initialAgents: Agent[] = [];

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
  activeAgentId: fallbackAgentId,
  settingsOpen: false,
  workspaces: [],
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
    const agent = get().agents.find((item) => item.id === activeAgentId);
    set({
      activeAgentId,
      activeWorkspaceId: agent?.workspace_id ?? get().activeWorkspaceId,
    });
    void get().save();
  },
  setActiveWorkspace: (workspaceId) => {
    const agent = get().agents.find((item) => item.workspace_id === workspaceId);
    set({
      activeWorkspaceId: workspaceId,
      activeAgentId: agent?.id ?? fallbackAgentId,
    });
    void get().save();
  },
  setActiveWorkspacePath: (path) => {
    set((state) => ({
      workspaces: state.workspaces.map((workspace) =>
        workspace.id === state.activeWorkspaceId
          ? {
              ...workspace,
              path,
              updatedAt: now(),
              synced: false,
            }
          : workspace,
      ),
    }));
    void get().save();
  },
  addWorkspace: (provider, pendingCommand, name) => {
    const state = get();
    const projectPath = state.settings.defaultProjectsPath.trim();
    if (!projectPath) {
      state.addLog(state.activeAgentId, "warn", "Selecione a pasta do projeto antes de criar workspaces.");
      return;
    }

    if (state.agents.length >= state.settings.maxAgents) {
      state.addLog(state.activeAgentId, "warn", "Limite maximo de workspaces simultaneos atingido.");
      return;
    }

    const workspaceIndex = state.workspaces.filter((item) => item.path).length + 1;
    const projectName = workspaceNameFromPath(projectPath);
    const workspace: Workspace = {
      id: id(),
      name: name ?? (workspaceIndex === 1 ? projectName : `${projectName} ${workspaceIndex}`),
      path: projectPath,
      updatedAt: now(),
      synced: false,
    };
    const agent = {
      ...createAgent("CODER", state.agents.length + 1, workspace.id, workspace.name),
      model: provider,
      pending_command: pendingCommand ?? (provider === "claude-code" ? "claude" : "codex"),
    };

    set((state) => ({
      workspaces: [...state.workspaces.filter((item) => item.path), workspace],
      agents: [...state.agents, agent],
      activeWorkspaceId: workspace.id,
      activeAgentId: agent.id,
    }));
    void get().save();
  },
  removeWorkspace: (workspaceId) => {
    const state = get();
    const removedAgentIds = new Set(state.agents.filter((agent) => agent.workspace_id === workspaceId).map((agent) => agent.id));
    const workspaces = state.workspaces.filter((workspace) => workspace.id !== workspaceId);
    const agents = state.agents.filter((agent) => !removedAgentIds.has(agent.id));
    const nextWorkspaceId = state.activeWorkspaceId === workspaceId ? workspaces[0]?.id ?? defaultWorkspace.id : state.activeWorkspaceId;
    const nextActiveAgent = agents.find((agent) => agent.workspace_id === nextWorkspaceId) ?? agents[0];

    set({
      workspaces,
      agents,
      activeWorkspaceId: nextWorkspaceId,
      activeAgentId: nextActiveAgent?.id ?? fallbackAgentId,
      logs: state.logs.filter((log) => !removedAgentIds.has(log.agentId)),
    });
    void get().save();
  },
  removeAllWorkspaces: () => {
    set({
      workspaces: [],
      agents: [],
      activeWorkspaceId: defaultWorkspace.id,
      activeAgentId: fallbackAgentId,
      logs: [],
    });
    void get().save();
  },
  addAgent: (role = "CODER") => {
    const state = get();
    if (state.agents.length >= state.settings.maxAgents) {
      state.addLog(state.activeAgentId, "warn", "Limite maximo de agentes simultaneos atingido.");
      return;
    }
    const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
    const agent = createAgent(
      role,
      state.agents.filter((item) => item.role === role).length + 1,
      activeWorkspace?.id ?? null,
      activeWorkspace?.path ? activeWorkspace.name : undefined,
    );
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
      agents: state.agents.map((agent) => (agent.id === agentId ? { ...agent, session_id: sessionId, status: "waiting" } : agent)),
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
    set((state) => ({ settings: normalizeSettings({ ...state.settings, ...patch }) }));
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
      activeAgentId: fallbackAgentId,
      settingsOpen: false,
      workspaces: [],
      agents: [],
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
        workspace_id: agent.workspace_id ?? persisted.activeWorkspaceId ?? null,
        session_id: null,
        status: "idle" as const,
      }));
      const workspaces = ((persisted.workspaces ?? []) as Workspace[]).filter((workspace) => workspace.path);
      const activeWorkspaceId = workspaces.some((workspace: Workspace) => workspace.id === persisted.activeWorkspaceId)
        ? persisted.activeWorkspaceId
        : workspaces[0]?.id ?? defaultWorkspace.id;
      const activeAgentId = agents.some((agent: Agent) => agent.id === persisted.activeAgentId)
        ? persisted.activeAgentId
        : agents.find((agent: Agent) => agent.workspace_id === activeWorkspaceId)?.id ?? agents[0]?.id ?? fallbackAgentId;
      set({
        ...persisted,
        workspaces,
        agents,
        activeWorkspaceId,
        activeAgentId,
        settings: normalizeSettings(persisted.settings),
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

function workspaceNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "Workspace";
}
