import { useState } from "react";
import { Headset, Loader2 } from "lucide-react";
import { api } from "@/shared/api/axios";
import { tokenStorage } from "@/shared/api/tokenStorage";
import { getErrorMessage } from "@/shared/api/errors";

type LoginResponse = { accessToken: string; refreshToken: string };

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, body?: object) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>(path, body);
      tokenStorage.set(res.data.accessToken, res.data.refreshToken);
      onSuccess();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Headset className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-extrabold tracking-tight">Hospital Softphone</h1>
          <p className="text-xs text-muted-foreground">상담원 소프트폰에 로그인하세요.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run("/api/auth/login", { email, password });
          }}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">이메일</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            로그인
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run("/api/auth/test-login")}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            테스트 로그인
          </button>
        </form>
      </div>
    </div>
  );
}
