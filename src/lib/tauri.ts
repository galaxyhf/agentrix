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

export async function browserNavigate(url: string) {
  if (!isTauri()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("browser_navigate", { url });
}

export async function browserBack() {
  if (!isTauri()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("browser_back");
}

export async function browserForward() {
  if (!isTauri()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("browser_forward");
}

export async function browserReload() {
  if (!isTauri()) {
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("browser_reload");
}

export async function checkCliStatus(provider: AgentModel) {
  if (!isTauri()) {
    return {
      provider,
      installed: false,
      authenticated: false,
      version: "Preview mode",
      executable: undefined,
      installMessage: "Validacao real disponivel apenas no app desktop.",
      authMessage: "Validacao real disponivel apenas no app desktop.",
      installHint: "",
      loginHint: "",
    } satisfies CliStatus;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<CliStatus>("check_cli_status", { provider });
}

export interface CliStatus {
  provider: AgentModel;
  installed: boolean;
  authenticated: boolean;
  version?: string;
  executable?: string;
  installMessage?: string;
  authMessage?: string;
  installHint: string;
  loginHint: string;
}

export type HostPlatform = "windows" | "macos" | "unix" | "web";

export async function getHostPlatform(): Promise<HostPlatform> {
  if (!isTauri()) {
    const platform = navigator.platform.toLowerCase();
    return platform.includes("win") ? "windows" : platform.includes("mac") ? "macos" : "web";
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HostPlatform>("host_platform");
}

export async function listenTauri<T>(event: string, handler: (payload: T) => void) {
  if (!isTauri()) {
    return () => undefined;
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, (message) => handler(message.payload));
}
