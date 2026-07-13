"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Device, type Call as TwilioCall } from "@twilio/voice-sdk";
import {
  CheckCircle2,
  Clock,
  Headset,
  HelpCircle,
  Mic,
  MicOff,
  MonitorDot,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  RefreshCw,
  Route,
  Users,
  X,
} from "lucide-react";
import { consultationApi } from "@/entities/consultation/api/consultationApi";
import type { ConsultationCallDirection } from "@/entities/consultation/model/types";
import { softphoneApi } from "@/entities/softphone/api/softphoneApi";
import { getErrorMessage } from "@/shared/api/errors";

type SoftphoneState = "offline" | "ready" | "ringing" | "in_call" | "after_call";
type SoftphoneTab = "inbound" | "outbound";
type CallDirection = "inbound" | "outbound";

type SessionCall = {
  id: string;
  direction: CallDirection;
  number: string;
  status: "완료" | "거절" | "취소" | "오류";
  durationSec: number;
  endedAt: string;
};

const SOFTPHONE_NUMBER = (import.meta.env.VITE_SOFTPHONE_NUMBER as string | undefined) ?? "+1 814 402 8603";
const DEFAULT_AGENT_IDENTITY = (import.meta.env.VITE_SOFTPHONE_AGENT_IDENTITY as string | undefined) ?? "agent-admin";
const AGENT_LINE = "내선 101";

const FLOW_STEPS = [
  { label: "전화 받기 대기", description: "상담원이 브라우저 Device를 등록합니다." },
  { label: "전화 인입", description: "Twilio Voice webhook이 상담원 Client로 연결합니다." },
  { label: "상담중", description: "상담원이 받으면 소프트폰 화면이 통화 상태로 바뀝니다." },
  { label: "후처리", description: "통화 종료 후 간단한 후처리 상태로 전환합니다." },
];

const STATE_META: Record<SoftphoneState, { label: string; dot: string; chip: string }> = {
  offline: {
    label: "오프라인",
    dot: "bg-muted-foreground/40",
    chip: "border-border bg-muted text-muted-foreground",
  },
  ready: {
    label: "수신 대기",
    dot: "bg-emerald-500",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  },
  ringing: {
    label: "전화 옴",
    dot: "bg-amber-500",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  },
  in_call: {
    label: "상담중",
    dot: "bg-blue-500",
    chip: "border-blue-500/30 bg-blue-500/10 text-blue-600",
  },
  after_call: {
    label: "후처리",
    dot: "bg-violet-500",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-600",
  },
};

type SoftphoneConsoleProps = {
  initialTab?: SoftphoneTab;
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function SoftphoneConsole({
  initialTab = "inbound",
  eyebrow = "Browser Softphone",
  title = "소프트폰 상담 콘솔",
  description = `${SOFTPHONE_NUMBER}로 들어오는 전화를 상담원 브라우저에서 받고 상담 상태를 관리합니다.`,
}: SoftphoneConsoleProps) {
  const [activeTab, setActiveTab] = useState<SoftphoneTab>(initialTab);
  const [guideOpen, setGuideOpen] = useState(false);
  const [deviceState, setDeviceState] = useState<SoftphoneState>("offline");
  const [agentIdentity, setAgentIdentity] = useState(DEFAULT_AGENT_IDENTITY);
  const [tokenStatus, setTokenStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [tokenMessage, setTokenMessage] = useState("수신 대기 시작 전");
  const [incomingCall, setIncomingCall] = useState<TwilioCall | null>(null);
  const [activeCall, setActiveCall] = useState<TwilioCall | null>(null);
  const [currentDirection, setCurrentDirection] = useState<CallDirection>("inbound");
  const [currentNumber, setCurrentNumber] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [activeDurationSec, setActiveDurationSec] = useState(0);
  const [sessionCalls, setSessionCalls] = useState<SessionCall[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("010-1234-5678");
  const [muted, setMuted] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const callErroredRef = useRef(false);
  const activeMetaRef = useRef<{ direction: CallDirection; number: string; startedAt: number | null }>({
    direction: "inbound",
    number: "발신자 번호 미확인",
    startedAt: null,
  });

  const currentMeta = STATE_META[deviceState];
  const showDialer = activeTab === "outbound";

  useEffect(() => {
    return () => {
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (deviceState !== "in_call" || !callStartedAt) return;
    const timer = window.setInterval(() => {
      setActiveDurationSec(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callStartedAt, deviceState]);

  const recordSessionCall = (status: SessionCall["status"]) => {
    const meta = activeMetaRef.current;
    const durationSec = meta.startedAt ? Math.max(0, Math.floor((Date.now() - meta.startedAt) / 1000)) : 0;
    setSessionCalls((prev) => [
      {
        id: `${Date.now()}-${prev.length}`,
        direction: meta.direction,
        number: meta.number,
        status,
        durationSec,
        endedAt: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev,
    ]);
  };

  const reportConsultationStatus = (
    status: Parameters<typeof consultationApi.updateMyStatus>[0]["status"],
    options: {
      direction?: CallDirection;
      phoneNumber?: string | null;
      message?: string | null;
    } = {}
  ) => {
    const direction = options.direction?.toUpperCase() as ConsultationCallDirection | undefined;
    void consultationApi.updateMyStatus({
      status,
      direction,
      phoneNumber: options.phoneNumber ?? null,
      message: options.message ?? null,
    }).catch(() => undefined);
  };

  const beginConsultation = (call: TwilioCall, direction: CallDirection, number: string) => {
    const startedAt = Date.now();
    callErroredRef.current = false;
    activeMetaRef.current = { direction, number, startedAt };
    setActiveCall(call);
    setIncomingCall(null);
    setCurrentDirection(direction);
    setCurrentNumber(number);
    setCallStartedAt(startedAt);
    setActiveDurationSec(0);
    setDeviceState("in_call");
    reportConsultationStatus("IN_CALL", { direction, phoneNumber: number, message: "상담 통화 진행 중" });
  };

  const clearCurrentCall = () => {
    setActiveCall(null);
    setIncomingCall(null);
    setCurrentNumber(null);
    setCallStartedAt(null);
    setActiveDurationSec(0);
    setMuted(false);
  };

  const setupCallHandlers = (call: TwilioCall, direction: CallDirection, number: string) => {
    call.on("accept", (acceptedCall: TwilioCall) => {
      beginConsultation(acceptedCall, direction, number);
    });
    call.on("disconnect", () => {
      recordSessionCall(callErroredRef.current ? "오류" : "완료");
      clearCurrentCall();
      setDeviceState("after_call");
      reportConsultationStatus(callErroredRef.current ? "ERROR" : "AFTER_CALL", {
        direction,
        phoneNumber: number,
        message: callErroredRef.current ? "통화 오류 후 상태 확인 필요" : "통화 종료 후 후처리 중",
      });
    });
    call.on("cancel", () => {
      recordSessionCall("취소");
      clearCurrentCall();
      setDeviceState("ready");
      reportConsultationStatus("AVAILABLE", { direction, phoneNumber: number, message: "인입 취소 후 수신 대기" });
    });
    call.on("reject", () => {
      recordSessionCall("거절");
      clearCurrentCall();
      setDeviceState("ready");
      reportConsultationStatus("AVAILABLE", { direction, phoneNumber: number, message: "통화 거절 후 수신 대기" });
    });
    call.on("error", (error: unknown) => {
      callErroredRef.current = true;
      setTokenStatus("error");
      setTokenMessage(errorMessage(error));
      reportConsultationStatus("ERROR", { direction, phoneNumber: number, message: errorMessage(error) });
    });
  };

  const connectDevice = async () => {
    setTokenStatus("loading");
    setTokenMessage("Twilio Access Token 발급 중");
    try {
      if (!Device.isSupported) {
        throw new Error("현재 브라우저는 Twilio Voice SDK를 지원하지 않습니다.");
      }
      const response = await softphoneApi.issueToken();
      setAgentIdentity(response.identity);

      deviceRef.current?.destroy();
      const device = new Device(response.token, {
        allowIncomingWhileBusy: false,
      });
      deviceRef.current = device;

      device.on("registered", () => {
        setTokenStatus("ready");
        setTokenMessage(`수신 대기 등록 완료 · ${new Date(response.expiresAt).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })} 만료`);
        setDeviceState("ready");
        reportConsultationStatus("AVAILABLE", { message: "브라우저 소프트폰 수신 대기 등록 완료" });
      });
      device.on("registering", () => {
        setDeviceState("offline");
        setTokenMessage("브라우저 수신 Device 등록 중");
      });
      device.on("unregistered", () => {
        setDeviceState("offline");
        setTokenMessage("브라우저 수신 Device 등록 해제");
        reportConsultationStatus("OFFLINE", { message: "브라우저 수신 Device 등록 해제" });
      });
      device.on("incoming", (call: TwilioCall) => {
        const from = call.parameters?.From ?? call.customParameters?.get("From") ?? "발신자 번호 미확인";
        activeMetaRef.current = { direction: "inbound", number: from, startedAt: null };
        setupCallHandlers(call, "inbound", from);
        setIncomingCall(call);
        setCurrentDirection("inbound");
        setCurrentNumber(from);
        setDeviceState("ringing");
        reportConsultationStatus("RINGING", { direction: "inbound", phoneNumber: from, message: "고객 전화 인입 중" });
      });
      device.on("tokenWillExpire", async (expiringDevice: Device) => {
        const refreshed = await softphoneApi.issueToken();
        expiringDevice.updateToken(refreshed.token);
        setTokenMessage(`토큰 갱신 완료 · ${new Date(refreshed.expiresAt).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })} 만료`);
      });
      device.on("error", (error: unknown) => {
        setTokenStatus("error");
        setTokenMessage(errorMessage(error));
        setDeviceState("offline");
        reportConsultationStatus("ERROR", { message: errorMessage(error) });
      });

      await device.register();
      setTokenStatus("ready");
    } catch (error) {
      setTokenStatus("error");
      setTokenMessage(errorMessage(error));
      setDeviceState("offline");
      reportConsultationStatus("ERROR", { message: errorMessage(error) });
    }
  };

  const startOutbound = async () => {
    if (!phoneNumber.trim()) return;
    if (!deviceRef.current) {
      await connectDevice();
    }
    const device = deviceRef.current;
    if (!device) return;
    try {
      const dialNumber = toE164Korea(phoneNumber);
      const call = await device.connect({ params: { To: dialNumber } });
      activeMetaRef.current = { direction: "outbound", number: dialNumber, startedAt: Date.now() };
      setupCallHandlers(call, "outbound", dialNumber);
      beginConsultation(call, "outbound", dialNumber);
    } catch (error) {
      setTokenStatus("error");
      setTokenMessage(errorMessage(error));
      reportConsultationStatus("ERROR", {
        direction: "outbound",
        phoneNumber,
        message: errorMessage(error),
      });
    }
  };

  const acceptIncoming = () => {
    incomingCall?.accept();
  };

  const rejectIncoming = () => {
    incomingCall?.reject();
  };

  const endCall = () => {
    activeCall?.disconnect();
  };

  const cancelReady = () => {
    deviceRef.current?.destroy();
    deviceRef.current = null;
    clearCurrentCall();
    setTokenStatus("idle");
    setTokenMessage("수신 대기 취소됨");
    setDeviceState("offline");
    reportConsultationStatus("OFFLINE", { message: "상담원이 수신 대기를 취소했습니다." });
  };

  const finishAfterCall = () => {
    setDeviceState("ready");
    reportConsultationStatus("AVAILABLE", { message: "후처리 완료 후 수신 대기" });
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    activeCall?.mute(nextMuted);
    setMuted(nextMuted);
  };

  return (
    <main className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-6xl px-4 py-8 pb-20">
      <section className="border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <PhoneCall className="h-4 w-4" />
              {eyebrow}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold hover:bg-accent"
            >
              <HelpCircle className="h-4 w-4" />
              안내
            </button>
            <div className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${currentMeta.chip}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${currentMeta.dot}`} />
              {currentMeta.label}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-background p-1 shadow-sm">
          <TabButton
            active={activeTab === "inbound"}
            label="전화 받기"
            subLabel="Inbound"
            tone="inbound"
            onClick={() => setActiveTab("inbound")}
          />
          <TabButton
            active={activeTab === "outbound"}
            label="전화 걸기"
            subLabel="Outbound"
            tone="outbound"
            onClick={() => setActiveTab("outbound")}
          />
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        {activeTab === "inbound" && (
          <InboundPanel
            agentIdentity={agentIdentity}
            deviceState={deviceState}
            tokenStatus={tokenStatus}
            tokenMessage={tokenMessage}
            currentNumber={currentNumber}
            currentDirection={currentDirection}
            activeDurationSec={activeDurationSec}
            muted={muted}
            onConnect={connectDevice}
            onAccept={acceptIncoming}
            onReject={rejectIncoming}
            onEnd={endCall}
            onCancelReady={cancelReady}
            onFinishAfterCall={finishAfterCall}
            onToggleMute={toggleMute}
          />
        )}

        {showDialer && (
          <OutboundPanel
            agentIdentity={agentIdentity}
            deviceState={deviceState}
            tokenStatus={tokenStatus}
            tokenMessage={tokenMessage}
            phoneNumber={phoneNumber}
            activeDurationSec={activeDurationSec}
            muted={muted}
            onPhoneNumberChange={setPhoneNumber}
            onConnect={connectDevice}
            onStartOutbound={startOutbound}
            onEnd={endCall}
            onFinishAfterCall={finishAfterCall}
            onToggleMute={toggleMute}
          />
        )}

        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-bold tracking-tight">이번 세션 통화 기록</h2>
            <span className="text-xs font-semibold text-muted-foreground">총 {sessionCalls.length}건</span>
          </div>

          {sessionCalls.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-5 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-semibold text-foreground">아직 처리한 전화가 없습니다.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                수신 대기 후 실제 전화가 종료되면 이 목록에 남습니다.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sessionCalls.map((call) => (
                <div key={call.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <DirectionBadge direction={call.direction} />
                      <p className="text-sm font-bold">{call.number}</p>
                      <p className="text-sm text-muted-foreground">{call.status}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {agentIdentity} / {AGENT_LINE}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono font-semibold">{formatDuration(call.durationSec)}</span>
                    <span className="text-muted-foreground">{call.endedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
      <ConsultationGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </main>
  );
}

function ConsultationGuideDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consultation-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-background shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Headset className="h-4 w-4" />
              상담 관리 안내
            </p>
            <h2 id="consultation-guide-title" className="mt-1 text-2xl font-extrabold tracking-tight">
              미용실 전화 상담 운영
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              현재 MVP는 상담 전화 1개를 브라우저 소프트폰 1명에게 연결합니다. 다중 상담원 ACD 분배는 실제 상담원 계정과 상태 저장이 생긴 뒤 붙이는 단계입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="안내 닫기"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <GuideSummaryCard
              icon={<PhoneCall className="h-5 w-5" />}
              label="상담 전화"
              value="1개"
              description={SOFTPHONE_NUMBER}
              tone="emerald"
            />
            <GuideSummaryCard
              icon={<Users className="h-5 w-5" />}
              label="현재 상담원"
              value="1명"
              description={DEFAULT_AGENT_IDENTITY}
              tone="blue"
            />
            <GuideSummaryCard
              icon={<Route className="h-5 w-5" />}
              label="라우팅"
              value="Softphone"
              description="Voice webhook -> Browser Client"
              tone="violet"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
            <section className="rounded-lg border border-border bg-card">
              <div className="border-b border-border p-4">
                <h3 className="text-base font-bold tracking-tight">현재 수신 구조</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  실제 전화 상태는 Twilio Device 이벤트로 전환됩니다.
                </p>
              </div>
              <div className="space-y-2 p-4">
                {FLOW_STEPS.map((step, index) => (
                  <div key={step.label} className="flex gap-3 rounded-md border border-border bg-background p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{step.label}</p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="space-y-5">
              <section className="rounded-lg border border-border bg-card">
                <div className="border-b border-border p-4">
                  <h3 className="text-base font-bold tracking-tight">MVP 기준</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    실제보다 큰 콜센터처럼 보이는 가짜 상담원/가짜 통화는 두지 않습니다.
                  </p>
                </div>
                <div className="grid gap-px bg-border sm:grid-cols-2">
                  <GuideStatusBlock
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="실제 연동"
                    description="수신 대기, 인입, 받기, 거절, 통화 종료"
                  />
                  <GuideStatusBlock
                    icon={<MonitorDot className="h-5 w-5" />}
                    title="현재 한계"
                    description="여러 상담원 상태 공유와 ACD 분배는 아직 목업 단계"
                  />
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-base font-bold tracking-tight">다음 구현 단위</h3>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>1. 로그인 사용자별 소프트폰 identity 발급</p>
                  <p>2. 상담원 상태를 백엔드에 저장하고 SSE/WebSocket으로 공유</p>
                  <p>3. 대표번호 1개에서 대기 상담원에게 자동 배분하는 ACD 라우팅</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuideSummaryCard({
  icon,
  label,
  value,
  description,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  description: string;
  tone: "emerald" | "blue" | "violet";
}) {
  const toneClass = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    blue: "bg-blue-500/10 text-blue-600",
    violet: "bg-violet-500/10 text-violet-600",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${toneClass}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 truncate text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function GuideStatusBlock({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-background p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-foreground">
        {icon}
      </span>
      <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function TabButton({
  active,
  label,
  subLabel,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  subLabel: string;
  tone: "inbound" | "outbound";
  onClick: () => void;
}) {
  const activeClass =
    tone === "inbound"
      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
      : "border-blue-600 bg-blue-600 text-white shadow-sm";
  const inactiveClass =
    tone === "inbound"
      ? "border-transparent text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-700"
      : "border-transparent text-muted-foreground hover:bg-blue-500/10 hover:text-blue-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 min-w-[126px] flex-col items-center justify-center rounded-md border px-4 text-sm transition-colors ${
        active ? activeClass : inactiveClass
      }`}
    >
      <span className="font-bold leading-none">{label}</span>
      <span className="mt-1 text-[11px] font-semibold leading-none opacity-70">{subLabel}</span>
    </button>
  );
}

function InboundPanel({
  agentIdentity,
  deviceState,
  tokenStatus,
  tokenMessage,
  currentNumber,
  currentDirection,
  activeDurationSec,
  muted,
  onConnect,
  onAccept,
  onReject,
  onEnd,
  onCancelReady,
  onFinishAfterCall,
  onToggleMute,
}: {
  agentIdentity: string;
  deviceState: SoftphoneState;
  tokenStatus: "idle" | "loading" | "ready" | "error";
  tokenMessage: string;
  currentNumber: string | null;
  currentDirection: CallDirection;
  activeDurationSec: number;
  muted: boolean;
  onConnect: () => void;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onCancelReady: () => void;
  onFinishAfterCall: () => void;
  onToggleMute: () => void;
}) {
  const meta = STATE_META[deviceState];
  return (
    <div className="rounded-lg border border-border bg-card">
      <PanelHeader title="전화 받기" agentIdentity={agentIdentity} meta={meta} />
      <div className="space-y-5 p-5">
        <CallStateCard
          deviceState={deviceState}
          currentNumber={currentNumber}
          currentDirection={currentDirection}
          activeDurationSec={activeDurationSec}
          muted={muted}
          onConnect={onConnect}
          onAccept={onAccept}
          onReject={onReject}
          onEnd={onEnd}
          onCancelReady={onCancelReady}
          onFinishAfterCall={onFinishAfterCall}
          onToggleMute={onToggleMute}
          tokenStatus={tokenStatus}
        />
        <IntegrationStatus tokenMessage={tokenMessage} tokenStatus={tokenStatus} />
      </div>
    </div>
  );
}

function OutboundPanel({
  agentIdentity,
  deviceState,
  tokenStatus,
  tokenMessage,
  phoneNumber,
  activeDurationSec,
  muted,
  onPhoneNumberChange,
  onConnect,
  onStartOutbound,
  onEnd,
  onFinishAfterCall,
  onToggleMute,
}: {
  agentIdentity: string;
  deviceState: SoftphoneState;
  tokenStatus: "idle" | "loading" | "ready" | "error";
  tokenMessage: string;
  phoneNumber: string;
  activeDurationSec: number;
  muted: boolean;
  onPhoneNumberChange: (value: string) => void;
  onConnect: () => void;
  onStartOutbound: () => void;
  onEnd: () => void;
  onFinishAfterCall: () => void;
  onToggleMute: () => void;
}) {
  const meta = STATE_META[deviceState];
  return (
    <div className="rounded-lg border border-border bg-card">
      <PanelHeader title="전화 걸기" agentIdentity={agentIdentity} meta={meta} />
      <div className="space-y-5 p-5">
        {deviceState === "in_call" || deviceState === "after_call" ? (
          <CallStateCard
            deviceState={deviceState}
            currentNumber={toE164Korea(phoneNumber)}
            currentDirection="outbound"
            activeDurationSec={activeDurationSec}
            muted={muted}
            onConnect={onConnect}
            onAccept={() => undefined}
            onReject={() => undefined}
            onEnd={onEnd}
            onFinishAfterCall={onFinishAfterCall}
            onToggleMute={onToggleMute}
            tokenStatus={tokenStatus}
          />
        ) : (
          <>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">고객 전화번호</label>
              <input
                value={phoneNumber}
                onChange={(event) => onPhoneNumberChange(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-base font-semibold tracking-wide outline-none focus:border-primary"
                placeholder="010-0000-0000"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={deviceState === "offline" ? onConnect : onStartOutbound}
                disabled={tokenStatus === "loading"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PhoneCall className="h-4 w-4" />
                {tokenStatus === "loading"
                  ? "연결 중"
                  : deviceState === "offline"
                    ? "소프트폰 켜기"
                    : "전화 걸기"}
              </button>
              <button
                type="button"
                onClick={onConnect}
                disabled={tokenStatus === "loading" || deviceState !== "offline"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-bold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                수신 등록
              </button>
            </div>
          </>
        )}
        <IntegrationStatus tokenMessage={tokenMessage} tokenStatus={tokenStatus} />
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  agentIdentity,
  meta,
}: {
  title: string;
  agentIdentity: string;
  meta: { label: string; dot: string; chip: string };
}) {
  return (
    <div className="border-b border-border p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{agentIdentity} / {AGENT_LINE}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-bold ${meta.chip}`}>
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>
    </div>
  );
}

function CallStateCard({
  deviceState,
  currentNumber,
  currentDirection,
  activeDurationSec,
  muted,
  onConnect,
  onAccept,
  onReject,
  onEnd,
  onCancelReady,
  onFinishAfterCall,
  onToggleMute,
  tokenStatus,
}: {
  deviceState: SoftphoneState;
  currentNumber: string | null;
  currentDirection: CallDirection;
  activeDurationSec: number;
  muted: boolean;
  onConnect: () => void;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onCancelReady?: () => void;
  onFinishAfterCall: () => void;
  onToggleMute: () => void;
  tokenStatus: "idle" | "loading" | "ready" | "error";
}) {
  if (deviceState === "offline") {
    return (
      <div className="space-y-4">
        <StageCard
          tone="emerald"
          icon={<PhoneIncoming className="h-5 w-5" />}
          title="수신 대기 전"
          description={`${SOFTPHONE_NUMBER}로 들어오는 전화를 받으려면 브라우저 Device를 먼저 등록합니다.`}
        />
        <button
          type="button"
          onClick={onConnect}
          disabled={tokenStatus === "loading"}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Phone className="h-4 w-4" />
          {tokenStatus === "loading" ? "수신 연결 중" : "수신 대기 시작"}
        </button>
      </div>
    );
  }

  if (deviceState === "ready") {
    return (
      <div className="space-y-4">
        <StageCard
          tone="emerald"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="전화 받기 대기중"
          description={`${SOFTPHONE_NUMBER}로 전화가 오면 이 화면이 자동으로 인입 상태로 바뀝니다.`}
        />
        <button
          type="button"
          onClick={onCancelReady}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-bold hover:bg-accent"
        >
          <PhoneOff className="h-4 w-4" />
          수신 대기 취소
        </button>
      </div>
    );
  }

  if (deviceState === "ringing") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <DirectionBadge direction="inbound" />
        <p className="mt-3 text-xs font-bold uppercase text-amber-700">현재 인입</p>
        <p className="mt-2 text-lg font-extrabold tracking-tight">{currentNumber ?? "발신자 번호 미확인"}</p>
        <p className="mt-1 text-sm text-muted-foreground">예약 문의 / 소프트폰 번호 {SOFTPHONE_NUMBER}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <Phone className="h-4 w-4" />
            받기
          </button>
          <button
            type="button"
            onClick={onReject}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-bold hover:bg-accent"
          >
            <PhoneOff className="h-4 w-4" />
            거절
          </button>
        </div>
      </div>
    );
  }

  if (deviceState === "in_call") {
    return (
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <DirectionBadge direction={currentDirection} />
        <p className="mt-3 text-xs font-bold uppercase text-blue-700">상담중</p>
        <p className="mt-2 text-lg font-extrabold tracking-tight">{currentNumber ?? "전화번호 미확인"}</p>
        <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-blue-700">{formatDuration(activeDurationSec)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-500/20 bg-background px-3 text-sm font-bold hover:bg-accent"
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {muted ? "음소거 중" : "마이크"}
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700"
          >
            <PhoneOff className="h-4 w-4" />
            통화 종료
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
      <p className="text-xs font-bold uppercase text-violet-700">후처리</p>
      <p className="mt-2 text-sm font-semibold text-foreground">상담이 종료되었습니다.</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">메모 저장이나 예약 확인 후 다시 수신 대기 상태로 전환합니다.</p>
      <button
        type="button"
        onClick={onFinishAfterCall}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-3 text-sm font-bold text-white hover:bg-violet-700"
      >
        <RefreshCw className="h-4 w-4" />
        후처리 완료
      </button>
    </div>
  );
}

function StageCard({
  tone,
  icon,
  title,
  description,
}: {
  tone: "emerald";
  icon: ReactNode;
  title: string;
  description: string;
}) {
  const toneClass = {
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

function DirectionBadge({ direction }: { direction: CallDirection }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
      direction === "inbound"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
        : "border-blue-500/30 bg-blue-500/10 text-blue-600"
    }`}>
      {direction === "inbound" ? <PhoneIncoming className="h-3 w-3" /> : <PhoneCall className="h-3 w-3" />}
      {direction === "inbound" ? "수신" : "발신"}
    </span>
  );
}

function IntegrationStatus({
  tokenMessage,
  tokenStatus,
}: {
  tokenMessage: string;
  tokenStatus: "idle" | "loading" | "ready" | "error";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground">연동 상태</p>
      <div className="mt-3 space-y-2 text-sm">
        <CheckRow text={tokenMessage} tone={tokenStatus} />
        <CheckRow text="브라우저 수신 Device 등록" tone={tokenStatus === "ready" ? "ready" : "idle"} />
        <CheckRow text="인입 TwiML 라우팅 연결" tone="ready" />
      </div>
    </div>
  );
}

function CheckRow({
  text,
  tone = "idle",
}: {
  text: string;
  tone?: "idle" | "loading" | "ready" | "error";
}) {
  const dotClass = {
    idle: "bg-muted-foreground/50",
    loading: "bg-amber-500",
    ready: "bg-emerald-500",
    error: "bg-red-500",
  }[tone];
  const textClass = tone === "error" ? "text-red-600" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <span className={textClass}>{text}</span>
    </div>
  );
}

function errorMessage(error: unknown) {
  const apiMessage = getErrorMessage(error, "");
  if (apiMessage) {
    return apiMessage;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Twilio Voice SDK 연결에 실패했습니다.";
}

function formatDuration(sec: number): string {
  const minutes = Math.floor(sec / 60).toString().padStart(2, "0");
  const seconds = (sec % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function toE164Korea(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  if (value.trim().startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+82${digits.slice(1)}`;
  }
  return `+${digits}`;
}
