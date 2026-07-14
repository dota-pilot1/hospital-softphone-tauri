import { useEffect, useRef, useState } from "react";
import { FlaskConical, Mic, Square } from "lucide-react";

type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: StepId; label: string; title: string }[] = [
  { id: 1, label: "1 · 미디어 캡처", title: "내 마이크 잡기 (getUserMedia)" },
  { id: 2, label: "2 · P2P 연결", title: "한 페이지에서 두 피어 잇기" },
  { id: 3, label: "3 · 시그널링", title: "두 기기 잇기 (WebSocket)" },
  { id: 4, label: "4 · 데이터 채널", title: "서버 없이 P2P 채팅" },
  { id: 5, label: "5 · 실전+Twilio", title: "NAT·STUN/TURN + 소프트폰 매핑" },
];

const SOON: Record<Exclude<StepId, 1>, string> = {
  2: "RTCPeerConnection 두 개(pcA·pcB)를 만들어 loopback 연결. SDP offer/answer·ICE candidate 로그를 눈으로 확인.",
  3: "백엔드 시그널링 WS(방 릴레이)로 두 탭/기기를 실제 연결. WebRTC=미디어, WebSocket=연결정보를 체감.",
  4: "RTCDataChannel로 서버 없이 피어끼리 텍스트 전송. WebSocket 채팅과 차이 비교.",
  5: "STUN으로 네트워크 넘어 연결 + 소프트폰의 Twilio Device가 이 개념들을 어떻게 감쌌는지 매핑.",
};

export function WebRtcLab() {
  const [step, setStep] = useState<StepId>(1);
  const current = STEPS.find((s) => s.id === step)!;

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 py-6">
      <section className="border-b border-border pb-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-600">
          <FlaskConical className="h-3.5 w-3.5" />
          WebRTC Lab
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">WebRTC 실습</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          소프트폰(Twilio Voice)이 결국 WebRTC 위에서 돈다. 밑바닥부터 손으로 익히는 학습 공간.
        </p>
      </section>

      {/* 스텝 탭 */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
              step === s.id
                ? "border-violet-500/40 bg-violet-500/10 text-violet-600"
                : "border-border bg-background text-muted-foreground hover:bg-accent"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <h2 className="text-base font-bold tracking-tight">{current.title}</h2>
        <div className="mt-3">{step === 1 ? <Step1Mic /> : <StepSoon text={SOON[step as Exclude<StepId, 1>]} />}</div>
      </div>
    </div>
  );
}

function StepSoon({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
      <p className="text-sm font-semibold">이 단계는 다음에 구현합니다.</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

/* ---------- Step 1: getUserMedia + 음량 미터 ---------- */
function Step1Mic() {
  const [running, setRunning] = useState(false);
  const [level, setLevel] = useState(0); // 0~100
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setRunning(false);
    setLevel(0);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      streamRef.current = stream;

      // 권한 이후 장치 목록(라벨) 채우기
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "audioinput"));

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);

      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(100, Math.round(rms * 240)));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      setRunning(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "마이크를 열지 못했습니다.");
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold">음량 미터</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">마이크를 잡아 내 목소리 크기를 실시간으로 그린다.</p>

        <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-violet-500 transition-[width] duration-75"
            style={{ width: `${level}%` }}
          />
        </div>
        <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{level}</p>

        <div className="mt-4 flex items-center gap-2">
          {!running ? (
            <button
              type="button"
              onClick={() => void start()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-bold text-white hover:bg-violet-700"
            >
              <Mic className="h-4 w-4" />
              마이크 시작
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-bold text-muted-foreground hover:bg-accent"
            >
              <Square className="h-4 w-4" />
              중지
            </button>
          )}
          {running && <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />캡처 중</span>}
        </div>

        {devices.length > 0 && (
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">입력 장치</span>
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none"
            >
              <option value="">기본 장치</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `마이크 ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">장치 바꾼 뒤 중지→시작하면 반영됩니다.</span>
          </label>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold">배우는 것</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>• <code className="rounded bg-muted px-1">navigator.mediaDevices.getUserMedia()</code> — 마이크 권한 + <code className="rounded bg-muted px-1">MediaStream</code></li>
          <li>• <b>Web Audio</b>(AudioContext·AnalyserNode)로 음량(RMS) 계산</li>
          <li>• <code className="rounded bg-muted px-1">enumerateDevices()</code> — 입력 장치 목록</li>
          <li>• 트랙 정리(<code className="rounded bg-muted px-1">track.stop()</code>)로 마이크 해제</li>
        </ul>
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
          <b>완료 기준</b> — 시작 → 권한 팝업 → 말하면 막대가 실시간으로 움직인다.
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">이게 소프트폰이 마이크를 잡는 첫 단계와 똑같다 (그래서 마이크 권한이 필요했던 것).</p>
      </div>
    </div>
  );
}
