import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { listenTauri, resizeAgentSession, startTerminalSession, stopAgentSession, writeAgentSession } from "@/lib/tauri";
import { useAppStore } from "@/store/app-store";
import type { Agent } from "@/lib/types";

interface OutputPayload {
  agentId: string;
  sessionId: string;
  data: string;
}

interface TerminalPaneProps {
  agent: Agent;
}

export function TerminalPane({ agent }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(agent.session_id);
  const terminalSizeRef = useRef<{ rows: number; cols: number } | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const pendingCommandRef = useRef<string | null | undefined>(agent.pending_command);
  const settings = useAppStore((state) => state.settings);
  const workspaces = useAppStore((state) => state.workspaces);
  const attachSession = useAppStore((state) => state.attachSession);
  const updateAgent = useAppStore((state) => state.updateAgent);
  const addLog = useAppStore((state) => state.addLog);
  const removeAgent = useAppStore((state) => state.removeAgent);
  const removeWorkspace = useAppStore((state) => state.removeWorkspace);
  const workspace = workspaces.find((item) => item.id === agent.workspace_id);

  useEffect(() => {
    sessionIdRef.current = agent.session_id;
  }, [agent.session_id]);

  useEffect(() => {
    pendingCommandRef.current = agent.pending_command;
  }, [agent.pending_command]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const terminal = new Terminal({
      allowTransparency: false,
      cursorBlink: settings.cursorBlink,
      cursorStyle: "block",
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: settings.fontSize,
      scrollback: settings.scrollback,
      theme: {
        background: token("--color-terminal-bg"),
        foreground: token("--color-text"),
        cursor: token("--color-text"),
        selectionBackground: "color-mix(in srgb, var(--color-accent) 35%, transparent)",
        black: token("--color-background"),
        red: token("--color-error"),
        green: token("--color-success"),
        yellow: token("--color-text"),
        blue: token("--color-text-muted"),
        magenta: token("--color-accent"),
        cyan: token("--color-accent-hover"),
        white: token("--color-text"),
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    fitRef.current = fit;
    fit.fit();
    terminalSizeRef.current = { rows: terminal.rows, cols: terminal.cols };

    const dataDisposable = terminal.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (sessionId && !sessionId.startsWith("preview-")) {
        void writeAgentSession(sessionId, data);
        return;
      }
      if (sessionId?.startsWith("preview-")) {
        terminal.write(data);
      }
    });

    const selectionDisposable = terminal.onSelectionChange(() => {
      if (!settings.copyOnSelect || !terminal.hasSelection()) {
        return;
      }
      void navigator.clipboard?.writeText(terminal.getSelection());
    });

    const fitAndResizeSession = () => {
      fit.fit();
      const size = { rows: terminal.rows, cols: terminal.cols };
      const previousSize = terminalSizeRef.current;

      if (previousSize?.rows === size.rows && previousSize.cols === size.cols) {
        return;
      }

      terminalSizeRef.current = size;
      const sessionId = sessionIdRef.current;
      if (sessionId && !sessionId.startsWith("preview-")) {
        if (resizeTimerRef.current !== null) {
          window.clearTimeout(resizeTimerRef.current);
        }
        resizeTimerRef.current = window.setTimeout(() => {
          const currentSessionId = sessionIdRef.current;
          if (currentSessionId && !currentSessionId.startsWith("preview-")) {
            void resizeAgentSession(currentSessionId, size.rows, size.cols);
          }
        }, 120);
      }
    };

    const observer = new ResizeObserver(() => {
      fitAndResizeSession();
    });
    observer.observe(containerRef.current);

    return () => {
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      dataDisposable.dispose();
      selectionDisposable.dispose();
      observer.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      terminalSizeRef.current = null;
    };
  }, [agent.id, agent.name, settings.copyOnSelect, settings.cursorBlink, settings.fontSize, settings.scrollback]);

  useEffect(() => {
    if (startedRef.current || agent.session_id || agent.status === "waiting" || agent.status === "running") {
      return;
    }

    startedRef.current = true;
    updateAgent(agent.id, { status: "waiting" });
    const terminalSize = terminalSizeRef.current;
    void startTerminalSession({
      agentId: agent.id,
      model: agent.model,
      modelId: "",
      reasoningEffort: "none",
      role: agent.role,
      systemPrompt: agent.system_prompt,
      cwd: workspace?.path || settings.defaultProjectsPath || undefined,
      shell: settings.defaultShell || undefined,
      rows: terminalSize?.rows ?? settings.terminalRows,
      cols: terminalSize?.cols ?? settings.terminalCols,
    })
      .then((started) => {
        sessionIdRef.current = started.sessionId;
        attachSession(agent.id, started.sessionId);
      })
      .catch((error) => {
        updateAgent(agent.id, { status: "error" });
        addLog(agent.id, "error", error instanceof Error ? error.message : String(error));
      });
  }, [
    addLog,
    agent.id,
    agent.role,
    agent.session_id,
    agent.status,
    agent.system_prompt,
    attachSession,
    settings.defaultProjectsPath,
    settings.defaultShell,
    settings.terminalCols,
    settings.terminalRows,
    updateAgent,
    workspace?.path,
  ]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void listenTauri<OutputPayload>("agent-session-output", (payload) => {
      if (payload.agentId !== agent.id) {
        return;
      }
      if (!sessionIdRef.current) {
        sessionIdRef.current = payload.sessionId;
      }
      if (payload.sessionId === sessionIdRef.current) {
        terminalRef.current?.write(payload.data);
      }
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      cleanup = dispose;
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [agent.id]);

  useEffect(() => {
    const sessionId = agent.session_id;
    const pendingCommand = pendingCommandRef.current;
    if (!sessionId || !pendingCommand || sessionId.startsWith("preview-")) {
      return;
    }

    pendingCommandRef.current = null;
    window.setTimeout(() => {
      void writeAgentSession(sessionId, `${pendingCommand}\r`);
      updateAgent(agent.id, { pending_command: null });
    }, 500);
  }, [agent.id, agent.session_id, updateAgent]);

  async function deleteTerminal() {
    if (agent.session_id && !agent.session_id.startsWith("preview-")) {
      await stopAgentSession(agent.session_id);
    }
    if (agent.workspace_id) {
      removeWorkspace(agent.workspace_id);
      return;
    }
    removeAgent(agent.id);
  }

  async function pasteFromClipboard() {
    if (!settings.pasteOnRightClick) {
      return;
    }
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      return;
    }
    const text = await navigator.clipboard?.readText();
    if (text) {
      await writeAgentSession(sessionId, text);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-terminal-bg">
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b bg-surface px-3 text-xs font-medium text-text">
        <span className="truncate">{workspace?.name ?? agent.name}</span>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
              className="size-6"
              onClick={() => void deleteTerminal()}
              aria-label={`Apagar ${agent.name}`}
            >
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Apagar terminal</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div
        ref={containerRef}
        className="terminal-shell min-h-0 flex-1 overflow-hidden"
        onContextMenu={(event) => {
          event.preventDefault();
          void pasteFromClipboard();
        }}
      />
    </div>
  );
}
