import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MainWorkspace } from "@/components/layout/main-workspace";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { LoginPage } from "@/pages/login-page";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/app-store";
import { listenTauri } from "@/lib/tauri";
import type { AgentStatus, TokenUsage } from "@/lib/types";

interface StatusPayload {
  agentId: string;
  sessionId: string;
  status: AgentStatus;
  message?: string;
}

interface TokenPayload extends TokenUsage {
  agentId: string;
  sessionId: string;
}

export default function App() {
  const booted = useAppStore((state) => state.booted);
  const authenticated = useAppStore((state) => state.authenticated);
  const load = useAppStore((state) => state.load);
  const updateAgent = useAppStore((state) => state.updateAgent);
  const detachSession = useAppStore((state) => state.detachSession);
  const updateTokenUsage = useAppStore((state) => state.updateTokenUsage);
  const addLog = useAppStore((state) => state.addLog);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cleanupStatus: (() => void) | undefined;
    let cleanupTokens: (() => void) | undefined;

    void listenTauri<StatusPayload>("agent-session-status", (payload) => {
      if (payload.status === "idle") {
        detachSession(payload.agentId);
      } else {
        updateAgent(payload.agentId, { status: payload.status });
      }
      if (payload.message) {
        addLog(payload.agentId, payload.status === "error" ? "error" : "info", payload.message);
      }
    }).then((cleanup) => {
      cleanupStatus = cleanup;
    });

    void listenTauri<TokenPayload>("agent-token-usage", (payload) => {
      updateTokenUsage(payload.agentId, payload.sessionId, payload);
    }).then((cleanup) => {
      cleanupTokens = cleanup;
    });

    return () => {
      cleanupStatus?.();
      cleanupTokens?.();
    };
  }, [addLog, detachSession, updateAgent, updateTokenUsage]);

  if (!booted) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-text">
        <Loader2 className="mr-2 size-4 animate-spin text-accent" />
        Inicializando Agentrix
      </div>
    );
  }

  if (!authenticated) {
    return (
      <TooltipProvider>
        <LoginPage />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full overflow-hidden bg-background text-text">
        <Sidebar />
        <MainWorkspace />
        <SettingsDialog />
      </div>
    </TooltipProvider>
  );
}
