import { useState } from "react";
import { Eye, EyeOff, Headset, Loader2, Lock, Mail, User } from "lucide-react";
import { api } from "@/shared/api/axios";
import { tokenStorage } from "@/shared/api/tokenStorage";
import { getErrorMessage } from "@/shared/api/errors";

type Mode = "login" | "signup";
type TokenResponse = { accessToken: string; refreshToken: string };

const BRAND = {
  name: "Hospital Softphone",
  subtitle: "상담원 소프트폰 콘솔",
  Icon: Headset,
  accentBg: "bg-emerald-600",
  accentBgHover: "hover:bg-emerald-700",
  accentText: "text-emerald-600",
};

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const { Icon } = BRAND;
  const isLogin = mode === "login";

  async function enter(res: TokenResponse) {
    tokenStorage.set(res.accessToken, res.refreshToken);
    onSuccess();
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
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
    setInfo(null);
    setPassword("");
    setConfirm("");
    setShowPw(false);
  };

  const pwMismatch = mode === "signup" && confirm.length > 0 && password !== confirm;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/40 to-background px-6">
      <div className="w-full max-w-[380px]">
        {/* 브랜드 */}
        <div className="mb-5 flex flex-col items-center gap-2">
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${BRAND.accentBg} text-white shadow-lg shadow-emerald-600/20`}>
            <Icon className="h-7 w-7" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">{BRAND.name}</h1>
          <p className="text-xs text-muted-foreground">{BRAND.subtitle}</p>
        </div>

        {/* 세그먼트 토글 */}
        <div className="relative mb-3 grid grid-cols-2 rounded-xl border border-border bg-muted/60 p-1">
          <span
            className="absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-background shadow-sm ring-1 ring-border transition-transform duration-200"
            style={{ transform: isLogin ? "translateX(4px)" : "translateX(calc(100% + 4px))" }}
          />
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`relative z-10 h-9 rounded-lg text-sm font-bold transition-colors ${
                mode === m ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            isLogin ? void doLogin() : void doSignup();
          }}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <IconField icon={Mail} label="이메일">
            <input
              type="email"
              autoComplete="username"
              placeholder="you@clinic.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </IconField>

          {mode === "signup" && (
            <IconField icon={User} label="이름">
              <input
                type="text"
                autoComplete="name"
                placeholder="홍길동"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
              />
            </IconField>
          )}

          <IconField
            icon={Lock}
            label="비밀번호"
            trailing={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 표시"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          >
            <input
              type={showPw ? "text" : "password"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "8자 이상" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </IconField>

          {mode === "signup" && (
            <IconField icon={Lock} label="비밀번호 확인" error={pwMismatch}>
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="다시 입력"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </IconField>
          )}

          {isLogin && (
            <div className="flex items-center justify-between text-xs">
              <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 accent-emerald-600"
                />
                로그인 상태 유지
              </label>
              <button
                type="button"
                onClick={() => setInfo("비밀번호 재설정은 관리자에게 문의하세요.")}
                className={`font-semibold ${BRAND.accentText} hover:underline`}
              >
                비밀번호 찾기
              </button>
            </div>
          )}

          {pwMismatch && <p className="text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {info && <p className="text-xs text-muted-foreground">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className={`mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg ${BRAND.accentBg} ${BRAND.accentBgHover} text-sm font-bold text-white shadow-sm disabled:opacity-50`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLogin ? "로그인" : "회원가입하고 시작하기"}
          </button>

          {isLogin && (
            <>
              <div className="my-1 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground">또는</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void doTestLogin()}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
              >
                테스트 계정으로 둘러보기
              </button>
            </>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {isLogin ? "계정이 없으신가요? " : "이미 계정이 있으신가요? "}
          <button
            type="button"
            onClick={() => switchMode(isLogin ? "signup" : "login")}
            className={`font-bold ${BRAND.accentText} hover:underline`}
          >
            {isLogin ? "회원가입" : "로그인"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputClass = "h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60";

function IconField({
  icon: Icon,
  label,
  trailing,
  error,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  trailing?: React.ReactNode;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={`flex items-center gap-2 rounded-lg border bg-background px-3 transition-colors focus-within:border-primary ${
          error ? "border-red-400" : "border-input"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        {children}
        {trailing}
      </span>
    </label>
  );
}
