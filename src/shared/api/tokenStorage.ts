import { getApiEnvironment } from "./apiEnvironment";

const accessMemory: Partial<Record<"local" | "production", string | null>> = {};

function keys() {
  const environment = getApiEnvironment();
  return {
    environment,
    access: `twilio.${environment}.accessToken`,
    refresh: `twilio.${environment}.refreshToken`,
  };
}

export const tokenStorage = {
  getAccess(): string | null {
    const key = keys();
    if (key.environment in accessMemory) return accessMemory[key.environment] ?? null;
    if (typeof window === "undefined") return null;
    const token = window.localStorage.getItem(key.access);
    accessMemory[key.environment] = token;
    return token;
  },
  getRefresh(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(keys().refresh);
  },
  set(access: string, refresh: string) {
    const key = keys();
    accessMemory[key.environment] = access;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key.access, access);
      window.localStorage.setItem(key.refresh, refresh);
    }
  },
  clear() {
    const key = keys();
    accessMemory[key.environment] = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key.access);
      window.localStorage.removeItem(key.refresh);
    }
  },
};
