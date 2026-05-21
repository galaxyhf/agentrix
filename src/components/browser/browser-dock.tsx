import { FormEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, Search } from "lucide-react";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Webview } from "@tauri-apps/api/webview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { browserBack, browserForward, browserNavigate, browserReload, isTauri } from "@/lib/tauri";

const browserLabel = "agentrix-browser";
const defaultUrl = "https://www.google.com";
const minBrowserWidth = 360;
const maxBrowserWidthRatio = 0.72;

interface BrowserDockProps {
  open: boolean;
}

export function BrowserDock({ open }: BrowserDockProps) {
  const [address, setAddress] = useState(defaultUrl);
  const [currentUrl, setCurrentUrl] = useState(defaultUrl);
  const [width, setWidth] = useState(560);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resizingRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<Webview | null>(null);

  const syncWebviewBounds = useCallback(async () => {
    const viewport = viewportRef.current;
    const webview = webviewRef.current;
    if (!viewport || !webview || !open) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    await webview.setPosition(new LogicalPosition(Math.round(rect.left), Math.round(rect.top)));
    await webview.setSize(new LogicalSize(width, height));
  }, [open]);

  const createWebview = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    if (webviewRef.current) {
      await webviewRef.current.show();
      await syncWebviewBounds();
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const existing = await Webview.getByLabel(browserLabel);
    if (existing) {
      webviewRef.current = existing;
      await existing.show();
      setReady(true);
      await syncWebviewBounds();
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const webview = new Webview(getCurrentWindow(), browserLabel, {
      url: currentUrl,
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
      backgroundColor: "#ffffff",
      focus: true,
    });

    webviewRef.current = webview;
    await webview.once("tauri://created", () => {
      setReady(true);
      setError(null);
      void syncWebviewBounds();
    });
    await webview.once<string>("tauri://error", (event) => {
      setError(event.payload || "Falha ao criar WebView do navegador.");
      setReady(false);
    });
  }, [currentUrl, syncWebviewBounds]);

  useEffect(() => {
    if (!open) {
      void webviewRef.current?.hide();
      return;
    }

    void createWebview();
  }, [createWebview, open]);

  useEffect(() => {
    if (!open || !isTauri()) {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const observer = new ResizeObserver(() => {
      void syncWebviewBounds();
    });
    observer.observe(viewport);

    const handleResize = () => {
      void syncWebviewBounds();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [open, syncWebviewBounds]);

  useEffect(() => {
    return () => {
      void webviewRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    void syncWebviewBounds();
  }, [open, syncWebviewBounds, width]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      if (!resizingRef.current) {
        return;
      }

      const nextWidth = window.innerWidth - event.clientX;
      setWidth(clampBrowserWidth(nextWidth));
    }

    function stopResize() {
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      void syncWebviewBounds();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [open, syncWebviewBounds]);

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUrl = normalizeAddress(address);
    setAddress(nextUrl);
    setCurrentUrl(nextUrl);
    setError(null);

    if (!isTauri()) {
      return;
    }

    await browserNavigate(nextUrl);
    await webviewRef.current?.setFocus();
  }

  async function navigateBack() {
    if (isTauri()) {
      await browserBack();
      await webviewRef.current?.setFocus();
    }
  }

  async function navigateForward() {
    if (isTauri()) {
      await browserForward();
      await webviewRef.current?.setFocus();
    }
  }

  async function reload() {
    if (isTauri()) {
      await browserReload();
      await webviewRef.current?.setFocus();
    }
  }

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <aside
      className={
        open
          ? "flex h-full min-w-[22.5rem] shrink-0 overflow-hidden border-l bg-surface"
          : "flex h-full w-0 min-w-0 shrink-0 flex-col overflow-hidden border-l-0 bg-surface"
      }
      style={open ? { width } : undefined}
      aria-hidden={!open}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar navegador"
        className="h-full w-1.5 shrink-0 cursor-col-resize bg-border/70 transition-colors hover:bg-accent"
        onPointerDown={startResize}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <form onSubmit={(event) => void submitAddress(event)} className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
          <Button type="button" variant="outline" size="icon" className="hover:bg-gray-800" onClick={() => void navigateBack()} aria-label="Voltar">
            <ArrowLeft />
          </Button>
          <Button type="button" variant="outline" size="icon" className="hover:bg-gray-800" onClick={() => void navigateForward()} aria-label="Avancar">
            <ArrowRight />
          </Button>
          <Button type="button" variant="outline" size="icon" className="hover:bg-gray-800" onClick={() => void reload()} aria-label="Recarregar">
            <RefreshCw />
          </Button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="h-9 min-w-0 pl-8 text-xs"
              placeholder="Digite uma URL ou pesquisa"
              aria-label="Barra de endereco"
            />
          </div>
        </form>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <div ref={viewportRef} className="absolute inset-0" />
          {!isTauri() && (
            <iframe
              title="Browser preview"
              src={currentUrl}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
            />
          )}
          {isTauri() && !ready && (
            <div className="grid h-full place-items-center bg-terminal-bg text-xs text-text-muted">
              Inicializando navegador
            </div>
          )}
          {error && (
            <div className="absolute inset-x-3 top-3 rounded-md border bg-background p-3 text-xs text-error">
              {error}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function normalizeAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return defaultUrl;
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const looksLikeDomain = /^[^\s]+\.[^\s]{2,}(\/.*)?$/i.test(trimmed);
  if (looksLikeDomain) {
    return `https://${trimmed}`;
  }

  const query = encodeURIComponent(trimmed);
  return `https://www.google.com/search?q=${query}`;
}

function clampBrowserWidth(width: number) {
  const maxWidth = Math.max(minBrowserWidth, Math.floor(window.innerWidth * maxBrowserWidthRatio));
  return Math.min(Math.max(width, minBrowserWidth), maxWidth);
}
