// Vite(데스크톱) 전용 API 환경. 기본은 운영(Cloud Run), 로컬 토글만 지원.
export type ApiEnvironment = "local" | "production";

const PRODUCTION_URL = "https://twillo-callbot-22483063703.asia-northeast3.run.app";
const LOCAL_URL = "http://localhost:4101";
const STORAGE_KEY = "hospital-softphone.apiEnvironment";

export function getApiEnvironment(): ApiEnvironment {
  if (typeof window === "undefined") return "production";
  return window.localStorage.getItem(STORAGE_KEY) === "local" ? "local" : "production";
}

export function getApiBaseUrl(environment: ApiEnvironment = getApiEnvironment()): string {
  return environment === "local" ? LOCAL_URL : PRODUCTION_URL;
}

export function setApiEnvironment(environment: ApiEnvironment) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, environment);
  window.dispatchEvent(new CustomEvent("api-environment:change", { detail: environment }));
}

export function subscribeApiEnvironment(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("api-environment:change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("api-environment:change", callback);
    window.removeEventListener("storage", callback);
  };
}
