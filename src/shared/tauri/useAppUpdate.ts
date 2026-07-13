"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// towercrane-axtrainer-tauri의 useAppUpdate 패턴을 twillo(Next.js)로 이식.
// Tauri 패키지는 dynamic import로 불러와 브라우저(웹) 빌드/실행에서는 조용히 no-op 처리한다.

export type AppUpdateStatus =
  | "idle"
  | "checking"
  | "uptodate"
  | "available"
  | "downloading"
  | "error";

export type AppUpdateState = {
  status: AppUpdateStatus;
  currentVersion: string;
  availableVersion: string;
  notes: string;
  progress: number;
  message: string;
};

type TauriUpdate = {
  version: string;
  body?: string | null;
  downloadAndInstall: (
    onEvent?: (event: {
      event: "Started" | "Progress" | "Finished";
      data: { contentLength?: number; chunkLength: number };
    }) => void
  ) => Promise<void>;
};

function isTauriRuntime() {
  if (typeof window === "undefined") return false;
  const candidate = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(candidate.__TAURI__ || candidate.__TAURI_INTERNALS__);
}

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "업데이트 확인에 실패했습니다.";

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>({
    status: "idle",
    currentVersion: "",
    availableVersion: "",
    notes: "",
    progress: 0,
    message: "",
  });
  const updateRef = useRef<TauriUpdate | null>(null);
  const startupCheckedRef = useRef(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    void (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const version = await getVersion();
        if (!cancelled) setState((current) => ({ ...current, currentVersion: version }));
      } catch {
        /* Tauri 밖 환경은 조용히 무시 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const checkForUpdate = useCallback(async (options?: { silent?: boolean }) => {
    if (!isTauriRuntime()) {
      setState((current) => ({ ...current, status: options?.silent ? "idle" : "error", message: options?.silent ? "" : "데스크톱 앱에서만 업데이트를 확인할 수 있습니다." }));
      return;
    }
    setState((current) => ({ ...current, status: "checking", message: "", progress: 0 }));
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = (await check()) as TauriUpdate | null;
      updateRef.current = update;
      if (update) {
        setState((current) => ({
          ...current,
          status: "available",
          availableVersion: update.version,
          notes: update.body ?? "",
          message: "",
          progress: 0,
        }));
      } else {
        setState((current) => ({
          ...current,
          status: "uptodate",
          availableVersion: "",
          notes: "",
          message: "",
          progress: 0,
        }));
      }
    } catch (error) {
      updateRef.current = null;
      setState((current) => ({
        ...current,
        status: options?.silent ? "idle" : "error",
        message: options?.silent ? "" : toErrorMessage(error),
      }));
    }
  }, []);

  const checkOnceOnStartup = useCallback(() => {
    if (startupCheckedRef.current) return;
    startupCheckedRef.current = true;
    void checkForUpdate({ silent: true });
  }, [checkForUpdate]);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setState((current) => ({ ...current, status: "downloading", message: "", progress: 0 }));
    try {
      let total = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) {
            setState((current) => ({
              ...current,
              progress: Math.min(100, Math.round((downloaded / total) * 100)),
            }));
          }
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      setState((current) => ({ ...current, status: "error", message: toErrorMessage(error) }));
    }
  }, []);

  return {
    state,
    checkForUpdate,
    checkOnceOnStartup,
    installUpdate,
    busy: state.status === "checking" || state.status === "downloading",
    hasUpdate: state.status === "available" || state.status === "downloading",
  };
}
