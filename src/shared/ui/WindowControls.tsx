import { useEffect, useState } from "react";
import { Maximize2, Minus, X } from "lucide-react";

type TauriWindow = {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
};

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function WindowControls() {
  const [appWindow, setAppWindow] = useState<TauriWindow | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let mounted = true;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      if (mounted) setAppWindow(getCurrentWindow());
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!appWindow) return null;

  return (
    <div className="flex items-center gap-1">
      <WindowButton label="최소화" onClick={() => void appWindow.minimize()}>
        <Minus className="h-4 w-4" />
      </WindowButton>
      <WindowButton label="최대화" onClick={() => void appWindow.toggleMaximize()}>
        <Maximize2 className="h-3.5 w-3.5" />
      </WindowButton>
      <WindowButton label="닫기" danger onClick={() => void appWindow.close()}>
        <X className="h-4 w-4" />
      </WindowButton>
    </div>
  );
}

function WindowButton({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors " +
        (danger
          ? "hover:border-red-500 hover:bg-red-500 hover:text-white"
          : "hover:border-border hover:bg-accent hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
