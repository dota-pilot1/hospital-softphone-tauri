import { useEffect, useState } from "react";
import { Headset, LogOut, RefreshCw } from "lucide-react";
import { tokenStorage } from "@/shared/api/tokenStorage";
import { useAppUpdate } from "@/shared/tauri/useAppUpdate";
import { Login } from "@/auth/Login";
import { SoftphoneConsole } from "@/features/softphone/SoftphoneConsole";

export function App() {
  const [authed, setAuthed] = useState(() => Boolean(tokenStorage.getAccess()));

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  const logout = () => {
    tokenStorage.clear();
    setAuthed(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopBar onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <SoftphoneConsole />
      </main>
    </div>
  );
}

function TopBar({ onLogout }: { onLogout: () => void }) {
  const appUpdate = useAppUpdate();
  const { state, busy, checkOnceOnStartup } = appUpdate;
  const canInstall = state.status === "available" || state.status === "downloading";

  useEffect(() => {
    checkOnceOnStartup();
  }, [checkOnceOnStartup]);

  const updateLabel =
    state.status === "checking"
      ? "확인 중"
      : state.status === "downloading"
        ? `${state.progress}%`
        : state.status === "available"
          ? "업데이트"
          : state.status === "error"
            ? "재시도"
            : "최신";

  return (
    <header
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 pl-20 backdrop-blur"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white">
          <Headset className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-extrabold tracking-tight">Hospital Softphone</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          title={
            state.status === "available"
              ? `새 버전 v${state.availableVersion} 설치`
              : state.currentVersion
                ? `현재 v${state.currentVersion}`
                : "업데이트 확인"
          }
          disabled={busy}
          onClick={() => (canInstall ? void appUpdate.installUpdate() : void appUpdate.checkForUpdate())}
          className={
            "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-bold transition-colors " +
            (state.status === "available"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-border bg-background text-muted-foreground hover:bg-accent")
          }
        >
          <RefreshCw className={"h-3 w-3 " + (state.status === "checking" ? "animate-spin" : "")} />
          {updateLabel}
          {state.currentVersion && <span className="tabular-nums opacity-70">v{state.currentVersion}</span>}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11px] font-semibold text-muted-foreground hover:bg-accent"
        >
          <LogOut className="h-3.5 w-3.5" />
          로그아웃
        </button>
      </div>
    </header>
  );
}
