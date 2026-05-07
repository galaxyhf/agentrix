import type { AgentModel, AgentRole, ReasoningEffort } from "@/lib/types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = () => typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

export interface StartSessionPayload {
  agentId: string;
  model: AgentModel;
  modelId: string;
  reasoningEffort: ReasoningEffort;
  role: AgentRole;
  systemPrompt: string;
  cwd?: string;
  rows?: number;
  cols?: number;
}

export interface StartTerminalPayload extends StartSessionPayload {
  shell?: string;
}

export interface SessionStarted {
  agentId: string;
  sessionId: string;
}

export async function startAgentSession(payload: StartSessionPayload): Promise<SessionStarted> {
  if (!isTauri()) {
    return {
      agentId: payload.agentId,
      sessionId: `preview-${payload.agentId}`,
    };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SessionStarted>("start_agent_session", { request: payload });
}

export async function startTerminalSession(payload: StartTerminalPayload): Promise<SessionStarted> {
  if (!isTauri()) {
    return {
      agentId: payload.agentId,
      sessionId: `preview-${payload.agentId}`,
    };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SessionStarted>("start_terminal_session", { request: payload });
}

export async function writeAgentSession(sessionId: string, data: string) {
  if (!isTauri()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_agent_session", { sessionId, data });
}

export async function stopAgentSession(sessionId: string) {
  if (!isTauri()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("stop_agent_session", { sessionId });
}

export async function resizeAgentSession(sessionId: string, rows: number, cols: number) {
  if (!isTauri()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("resize_agent_session", { sessionId, rows, cols });
}

export async function checkCliStatus(provider: AgentModel) {
  if (!isTauri()) {
    return "Preview mode";
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("check_cli_status", { provider });
}

export async function listenTauri<T>(event: string, handler: (payload: T) => void) {
  if (!isTauri()) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, (message) => handler(message.payload));
}
