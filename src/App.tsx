import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MainWorkspace } from "@/components/layout/main-workspace";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { LoginPage } from "@/pages/login-page";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/app-store";
import { listenTauri } from "@/lib/tauri";
import type { AgentrixSettings, AgentStatus, TokenUsage } from "@/lib/types";

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

interface OutputPayload {
  agentId: string;
  sessionId: string;
  data: string;
}

type ThemeVariables = Partial<Record<`--${string}`, string>>;
type AppThemeStyle = CSSProperties & ThemeVariables;

export default function App() {
  const booted = useAppStore((state) => state.booted);
  const authenticated = useAppStore((state) => state.authenticated);
  const load = useAppStore((state) => state.load);
  const updateAgent = useAppStore((state) => state.updateAgent);
  const detachSession = useAppStore((state) => state.detachSession);
  const updateTokenUsage = useAppStore((state) => state.updateTokenUsage);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const addLog = useAppStore((state) => state.addLog);
  const settings = useAppStore((state) => state.settings);
  const activityTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const variables = themeVariables(settings);
    Object.entries(variables).forEach(([property, value]) => {
      if (value === undefined) {
        return;
      }
      document.documentElement.style.setProperty(property, value);
    });
  }, [settings.accent, settings.colorTheme]);

  useEffect(() => {
    function toggleSidebar(event: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const modifierPressed = isMac ? event.metaKey : event.ctrlKey;

      if (!modifierPressed || event.altKey || event.shiftKey || event.key.toLowerCase() !== "b") {
        return;
      }

      event.preventDefault();
      updateSettings({ sidebarCollapsed: !useAppStore.getState().settings.sidebarCollapsed });
    }

    window.addEventListener("keydown", toggleSidebar);
    return () => window.removeEventListener("keydown", toggleSidebar);
  }, [updateSettings]);

  useEffect(() => {
    let cleanupStatus: (() => void) | undefined;
    let cleanupTokens: (() => void) | undefined;
    let cleanupOutput: (() => void) | undefined;
    let cleanupOpenFolder: (() => void) | undefined;

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

    void listenTauri<OutputPayload>("agent-session-output", (payload) => {
      const currentAgent = useAppStore.getState().agents.find((agent) => agent.id === payload.agentId);
      if (!currentAgent || currentAgent.session_id !== payload.sessionId || currentAgent.status === "error") {
        return;
      }

      if (currentAgent.status !== "running") {
        updateAgent(payload.agentId, { status: "running" });
      }

      const previousTimer = activityTimers.current.get(payload.agentId);
      if (previousTimer) {
        clearTimeout(previousTimer);
      }

      const timer = setTimeout(() => {
        const latestAgent = useAppStore.getState().agents.find((agent) => agent.id === payload.agentId);
        if (latestAgent?.session_id === payload.sessionId && latestAgent.status === "running") {
          updateAgent(payload.agentId, { status: "waiting" });
        }
        activityTimers.current.delete(payload.agentId);
      }, 1400);

      activityTimers.current.set(payload.agentId, timer);
    }).then((cleanup) => {
      cleanupOutput = cleanup;
    });

    void listenTauri("agentrix-open-folder", async () => {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          title: "Abrir pasta",
        });
        if (typeof selected === "string") {
          updateSettings({ defaultProjectsPath: selected });
          addWorkspace(selected);
          addLog("no-terminal-selected", "info", `Pasta selecionada: ${selected}`);
        }
      } catch (error) {
        addLog("no-terminal-selected", "error", error instanceof Error ? error.message : String(error));
      }
    }).then((cleanup) => {
      cleanupOpenFolder = cleanup;
    });

    return () => {
      activityTimers.current.forEach((timer) => clearTimeout(timer));
      activityTimers.current.clear();
      cleanupStatus?.();
      cleanupTokens?.();
      cleanupOutput?.();
      cleanupOpenFolder?.();
    };
  }, [addLog, addWorkspace, detachSession, updateAgent, updateSettings, updateTokenUsage]);

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
      <div
        className="flex h-full overflow-hidden bg-background text-text"
        data-density={settings.density}
        style={appStyle(settings)}
      >
        <Sidebar />
        <MainWorkspace />
        <SettingsDialog />
      </div>
    </TooltipProvider>
  );
}

function appStyle(settings: AgentrixSettings): AppThemeStyle {
  return {
    ...themeVariables(settings),
    zoom: `${Math.min(150, Math.max(75, settings.zoom))}%`,
  };
}

function themeVariables(settings: AgentrixSettings): ThemeVariables {
  const accents = {
    violet: { accent: "#7c3aed", hover: "#a855f7", ring: "168 85 247" },
    purple: { accent: "#9333ea", hover: "#c084fc", ring: "192 132 252" },
    fuchsia: { accent: "#c026d3", hover: "#e879f9", ring: "232 121 249" },
    red: { accent: "#dc2626", hover: "#ef4444", ring: "239 68 68" },
  };
  const colorThemes = {
    default: {
      "--color-background": "#0d0d0f",
      "--color-surface": "#110e1c",
      "--color-card": "#1a1428",
      "--color-border": "#2a1f4a",
      "--color-terminal-bg": "#090911",
      "--background": "13 13 15",
      "--card": "26 20 40",
      "--popover": "17 14 28",
      "--secondary": "26 20 40",
      "--muted": "17 14 28",
      "--border": "42 31 74",
      "--input": "21 15 37",
    },
    "full-black": {
      "--color-background": "#000000",
      "--color-surface": "#050505",
      "--color-card": "#080808",
      "--color-border": "#1a1a1a",
      "--color-terminal-bg": "#000000",
      "--background": "0 0 0",
      "--card": "8 8 8",
      "--popover": "5 5 5",
      "--secondary": "8 8 8",
      "--muted": "5 5 5",
      "--border": "26 26 26",
      "--input": "12 12 12",
    },
  } satisfies Record<AgentrixSettings["colorTheme"], ThemeVariables>;
  const selected = accents[settings.accent];

  return {
    ...colorThemes[settings.colorTheme],
    "--color-accent": selected.accent,
    "--color-accent-hover": selected.hover,
    "--ring": selected.ring,
  };
}
