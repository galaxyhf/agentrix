export type AgentRole = "CODER" | "THINKER" | "REVIEWER" | "RESEARCHER" | "CUSTOM";
export type AgentModel = "claude-code" | "codex";
export type AgentStatus = "idle" | "running" | "waiting" | "error";
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  model: AgentModel;
  system_prompt: string;
  status: AgentStatus;
  color: string;
  session_id: string | null;
  tokens: TokenUsage;
}

export interface AgentTemplate {
  role: AgentRole;
  name: string;
  color: string;
  prompt: string;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  updatedAt: string;
  synced: boolean;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
}

export interface ProviderConnection {
  provider: AgentModel;
  connected: boolean;
  version?: string;
  lastChecked?: string;
  error?: string;
}

export interface AgentrixSettings {
  fontSize: number;
  terminalRows: number;
  terminalCols: number;
  density: "compact" | "comfortable" | "spacious";
  accent: "violet" | "purple" | "fuchsia";
  transparency: boolean;
  animations: boolean;
  zoom: number;
  cursorBlink: boolean;
  scrollback: number;
  defaultShell: string;
  copyOnSelect: boolean;
  pasteOnRightClick: boolean;
  ptyPerformance: "balanced" | "latency" | "throughput";
  autoRestart: boolean;
  maxAgents: number;
  agentTimeout: number;
  defaultProjectsPath: string;
  autoSave: boolean;
  offlineSync: boolean;
  supabaseUrl: string;
  tokenLimit: number;
  costAlert: number;
  dailyReset: boolean;
  updateChannel: "alpha" | "beta" | "stable";
  autoUpdate: boolean;
  debugMode: boolean;
  tauriEvents: boolean;
  backendLogLevel: "error" | "warn" | "info" | "debug";
}

export interface SessionLog {
  id: string;
  agentId: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
}
