import { useEffect, useState } from "react";
import { Headset, LogOut, Radio } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { tokenStorage } from "@/shared/api/tokenStorage";
import { useAppUpdate } from "@/shared/tauri/useAppUpdate";
import { Login } from "@/auth/Login";
import { SoftphoneConsole } from "@/features/softphone/SoftphoneConsole";
import { ConsultationMonitor } from "@/features/consultation/ConsultationMonitor";

type View = "softphone" | "consultation";

const NAV: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "softphone", label: "소프트폰", icon: Headset },
  { id: "consultation", label: "상담 관리", icon: Radio },
];

export function App() {
  const [authed, setAuthed] = useState(() => Boolean(tokenStorage.getAccess()));
  const [view, setView] = useState<View>("softphone");

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  const logout = () => {
    tokenStorage.clear();
    setAuthed(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Rail view={view} setView={setView} onLogout={logout} />
      <main className="ml-[76px] min-h-screen overflow-y-auto">
        {view === "softphone" ? <SoftphoneConsole /> : <ConsultationMonitor />}
      </main>
    </div>
  );
}

function Rail({
  view,
  setView,
  onLogout,
}: {
  view: View;
  setView: (v: View) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[76px] flex-col border-r border-border bg-sidebar">
      <div data-tauri-drag-region className="flex h-14 items-center justify-center border-b border-border">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Headset className="h-4.5 w-4.5" />
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold transition-colors ${
                active
                  ? "bg-emerald-600/10 text-emerald-600"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1.5 border-t border-border py-2">
        <RailUpdateBadge />
        <button
          type="button"
          onClick={onLogout}
          aria-label="로그아웃"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}

function RailUpdateBadge() {
  const appUpdate = useAppUpdate();
  const { state, busy, checkOnceOnStartup } = appUpdate;
  const canInstall = state.status === "available" || state.status === "downloading";

  useEffect(() => {
    checkOnceOnStartup();
  }, [checkOnceOnStartup]);

  const label =
    state.status === "checking"
      ? "확인"
      : state.status === "downloading"
        ? `${state.progress}%`
        : state.status === "available"
          ? "업데이트"
          : "최신";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        title={state.currentVersion ? `현재 v${state.currentVersion}` : "업데이트 확인"}
        disabled={busy}
        onClick={() => (canInstall ? void appUpdate.installUpdate() : void appUpdate.checkForUpdate())}
        className={`grid h-5 w-[56px] place-items-center rounded-md border text-[9px] font-black leading-none transition-colors ${
          state.status === "available"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-border bg-background text-muted-foreground hover:bg-accent"
        }`}
      >
        {label}
      </button>
      {state.currentVersion && (
        <span className="text-[9px] font-semibold tabular-nums text-muted-foreground/70">v{state.currentVersion}</span>
      )}
    </div>
  );
}
