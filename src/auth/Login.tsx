import { useState } from "react";
import { Headset, Loader2 } from "lucide-react";
import { api } from "@/shared/api/axios";
import { tokenStorage } from "@/shared/api/tokenStorage";
import { getErrorMessage } from "@/shared/api/errors";

type Mode = "login" | "signup";
type TokenResponse = { accessToken: string; refreshToken: string };

const BRAND = {
  name: "Hospital Softphone",
  subtitle: "상담원 소프트폰",
  accent: "emerald",
  Icon: Headset,
};

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { Icon } = BRAND;

  async function enter(res: TokenResponse) {
    tokenStorage.set(res.accessToken, res.refreshToken);
    onSuccess();
  }

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const doLogin = () =>
    run(async () => {
      const res = await api.post<TokenResponse>("/api/auth/login", { email, password });
      await enter(res.data);
    });

  const doTestLogin = () =>
    run(async () => {
      const res = await api.post<TokenResponse>("/api/auth/test-login");
      await enter(res.data);
    });

  const doSignup = () =>
    run(async () => {
      if (!username.trim()) throw new Error("이름을 입력하세요.");
      if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
      if (password !== confirm) throw new Error("비밀번호가 일치하지 않습니다.");
      await api.post("/api/auth/signup", { email, username, password });
      const res = await api.post<TokenResponse>("/api/auth/login", { email, password });
      await enter(res.data);
    });

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirm("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Icon className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-extrabold tracking-tight">{BRAND.name}</h1>
          <p className="text-xs text-muted-foreground">{BRAND.subtitle} 콘솔</p>
        </div>

        {/* 모드 탭 */}
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`h-8 rounded-md text-xs font-bold transition-colors ${
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mode === "login" ? void doLogin() : void doSignup();
          }}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
        >
          <Field label="이메일">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>

          {mode === "signup" && (
            <Field label="이름">
              <input
                type="text"
                autoComplete="name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}

          <Field label="비밀번호" hint={mode === "signup" ? "8자 이상" : undefined}>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>

          {mode === "signup" && (
            <Field
              label="비밀번호 확인"
              hint={
                confirm.length > 0
                  ? password === confirm
                    ? "✓ 일치합니다."
                    : "✗ 일치하지 않습니다."
                  : undefined
              }
              hintTone={confirm.length > 0 && password !== confirm ? "error" : "ok"}
            >
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "로그인" : "회원가입"}
          </button>

          {mode === "login" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void doTestLogin()}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              테스트 로그인
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";

function Field({
  label,
  hint,
  hintTone = "ok",
  children,
}: {
  label: string;
  hint?: string;
  hintTone?: "ok" | "error";
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && (
        <span className={`text-[11px] ${hintTone === "error" ? "text-red-500" : "text-muted-foreground"}`}>{hint}</span>
      )}
    </label>
  );
}
