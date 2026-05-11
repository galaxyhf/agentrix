export type AgentRole = "CODER" | "THINKER" | "REVIEWER" | "RESEARCHER" | "CUSTOM";
export type AgentModel = "claude-code" | "codex";
export type AgentStatus = "idle" | "running" | "waiting" | "error";
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface WorkspaceProfile {
  id: string;
  name: string;
  codexCount: number;
  claudeCount: number;
  updatedAt: string;
}

export interface Agent {
  id: string;
  workspace_id: string | null;
  name: string;
  role: AgentRole;
  model: AgentModel;
  system_prompt: string;
  status: AgentStatus;
  color: string;
  session_id: string | null;
  tokens: TokenUsage;
  pending_command?: string | null;
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
  installed?: boolean;
  authenticated?: boolean;
  version?: string;
  executable?: string;
  lastChecked?: string;
  error?: string;
  authMessage?: string;
  installHint?: string;
  loginHint?: string;
}

export interface AgentrixSettings {
  fontSize: number;
  density: "compact" | "comfortable" | "spacious";
  accent: "violet" | "purple" | "fuchsia" | "red";
  zoom: number;
  cursorBlink: boolean;
  defaultShell: string;
  pasteOnRightClick: boolean;
  workspaceLayout: "single" | "grid";
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
  workspaceProfiles: WorkspaceProfile[];
}

export interface SessionLog {
  id: string;
  agentId: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
}
