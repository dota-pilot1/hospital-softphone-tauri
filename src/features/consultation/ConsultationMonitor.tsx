
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Building2,
  ChevronRight,
  Clock,
  Headset,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  Timer,
  UserRound,
} from "lucide-react";
import {
  consultationApi,
  createConsultationStatusWebSocket,
} from "@/entities/consultation/api/consultationApi";
import type {
  ConsultationAgentCallsResponse,
  ConsultationAgentStatus,
  ConsultationAgentStatusResponse,
  ConsultationCallDirection,
  ConsultationCallLogResponse,
  ConsultationStatusSnapshotResponse,
} from "@/entities/consultation/model/types";

const STATUS_TONE: Record<ConsultationAgentStatus, string> = {
  OFFLINE: "bg-muted-foreground/40",
  ONLINE: "bg-sky-500",
  AVAILABLE: "bg-emerald-500",
  RINGING: "bg-amber-500",
  IN_CALL: "bg-blue-500",
  AFTER_CALL: "bg-violet-500",
  ERROR: "bg-red-500",
};

const STATUS_LABEL: Record<ConsultationAgentStatus, string> = {
  OFFLINE: "오프라인",
  ONLINE: "온라인",
  AVAILABLE: "대기중",
  RINGING: "수신중",
  IN_CALL: "통화중",
  AFTER_CALL: "후처리중",
  ERROR: "오류",
};

const STATUS_DETAIL: Record<ConsultationAgentStatus, string> = {
  OFFLINE: "앱 미접속 (로그아웃/종료)",
  ONLINE: "앱 접속 중 · 수신 대기 전",
  AVAILABLE: "전화 받기 대기 중",
  RINGING: "고객 전화 인입 중",
  IN_CALL: "상담 통화 진행 중",
  AFTER_CALL: "통화 종료 후 후처리 중",
  ERROR: "상태 확인 필요",
};

export function ConsultationMonitor() {
  const [agents, setAgents] = useState<ConsultationAgentStatusResponse[]>([]);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "fallback">("connecting");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const loadInitial = async () => {
      try {
        const data = await consultationApi.listAgents();
        if (!closed) setAgents(data);
      } catch {
        if (!closed) setConnectionState("fallback");
      }
    };

    const connect = () => {
      socket = createConsultationStatusWebSocket();
      if (!socket) {
        setConnectionState("fallback");
        return;
      }

      socket.onopen = () => {
        if (!closed) setConnectionState("connected");
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as ConsultationStatusSnapshotResponse;
          if (payload.type === "SNAPSHOT" && !closed) {
            setAgents(payload.agents);
          }
        } catch {
          // Ignore malformed frames. The REST fallback keeps the page usable.
        }
      };
      socket.onclose = () => {
        if (closed) return;
        setConnectionState("fallback");
        reconnectTimer = window.setTimeout(connect, 3000);
      };
      socket.onerror = () => {
        if (!closed) setConnectionState("fallback");
        socket?.close();
      };
    };

    void loadInitial();
    connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const metrics = useMemo(() => {
    const count = (statuses: ConsultationAgentStatus[]) =>
      agents.filter((agent) => statuses.includes(agent.status)).length;

    return {
      activeCalls: count(["IN_CALL", "RINGING"]),
      available: count(["AVAILABLE"]),
      outboundToday: agents.filter((agent) => agent.direction === "OUTBOUND").length,
      afterCall: count(["AFTER_CALL"]),
    };
  }, [agents]);

  const callRows = useMemo(
    () => agents.filter((agent) => agent.phoneNumber || agent.status === "IN_CALL" || agent.status === "RINGING"),
    [agents]
  );

  return (
      <main className="min-h-[calc(100vh-3.5rem)] w-full bg-background">
        <div className="mx-auto grid w-full max-w-[1500px] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
          <AgentSidebar agents={agents} selectedAgentId={selectedAgentId} onSelect={setSelectedAgentId} />

          <div className="min-w-0 px-4 py-5 pb-10 lg:px-6">
            <section className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Headset className="h-3.5 w-3.5" />
                  Consultation Monitor
                </p>
                <h1 className="mt-0.5 text-xl font-extrabold tracking-tight">상담 관리</h1>
              </div>
              <ConnectionBadge state={connectionState} />
            </section>

            {selectedAgentId !== null ? (
              <AgentDetailView
                agentId={selectedAgentId}
                liveAgent={agents.find((agent) => agent.agentId === selectedAgentId) ?? null}
                onBack={() => setSelectedAgentId(null)}
              />
            ) : (
              <>
                <section className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  <MetricCard icon={<PhoneCall className="h-4 w-4" />} label="진행 중" value={`${metrics.activeCalls}건`} tone="blue" />
                  <MetricCard icon={<PhoneIncoming className="h-4 w-4" />} label="대기중" value={`${metrics.available}명`} tone="emerald" />
                  <MetricCard icon={<PhoneOutgoing className="h-4 w-4" />} label="발신 상태" value={`${metrics.outboundToday}명`} tone="violet" />
                  <MetricCard icon={<Clock className="h-4 w-4" />} label="후처리" value={`${metrics.afterCall}명`} tone="amber" />
                </section>

                <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border p-4">
                      <div>
                        <h2 className="text-base font-bold tracking-tight">통화 상태 타임라인</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">상담원별 최신 통화 상태를 실시간으로 봅니다.</p>
                      </div>
                      <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        실시간
                      </span>
                    </div>
                    {callRows.length === 0 ? (
                      <EmptyState title="표시할 통화 상태가 없습니다." description="상담사 트리에서 상담원을 클릭하면 통화 이력과 실적을 볼 수 있습니다." />
                    ) : (
                      <div className="divide-y divide-border">
                        {callRows.map((agent) => (
                          <CallRow key={agent.agentId} agent={agent} onSelect={setSelectedAgentId} />
                        ))}
                      </div>
                    )}
                    <div className="border-t border-border bg-muted/30 p-4">
                      <div className="flex items-start gap-2.5 rounded-md border border-dashed border-border bg-background p-3">
                        <Activity className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="text-xs font-bold">연동 방식</p>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                            소프트폰 화면의 Twilio Device 이벤트가 백엔드 상태 API를 갱신하고, 백엔드는 WebSocket으로 상담 관리 화면에 스냅샷을 전송합니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card">
                    <div className="border-b border-border p-4">
                      <h2 className="text-base font-bold tracking-tight">상담원 상태</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">상담원을 클릭하면 통화 이력·실적을 봅니다.</p>
                    </div>
                    {agents.length === 0 ? (
                      <EmptyState title="등록된 상담원이 없습니다." description="소프트폰에서 수신 대기를 시작하면 상담원이 표시됩니다." />
                    ) : (
                      <div className="divide-y divide-border">
                        {agents.map((agent) => (
                          <AgentRow key={agent.agentId} agent={agent} onSelect={setSelectedAgentId} />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </main>
  );
}

function AgentSidebar({
  agents,
  selectedAgentId,
  onSelect,
}: {
  agents: ConsultationAgentStatusResponse[];
  selectedAgentId: number | null;
  onSelect: (agentId: number | null) => void;
}) {
  const [orgOpen, setOrgOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);
  const onlineCount = agents.filter((agent) => agent.status !== "OFFLINE").length;

  return (
    <aside className="border-b border-border bg-sidebar px-3 py-4 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Agents</p>
          <h2 className="mt-0.5 text-base font-extrabold tracking-tight">상담사 트리</h2>
        </div>
        <span
          className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold ${
            onlineCount > 0
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
              : "border-border bg-background text-muted-foreground"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${onlineCount > 0 ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
          {onlineCount > 0 ? `온라인 ${onlineCount}` : `전체 ${agents.length}`}
        </span>
      </div>

      <nav className="mt-4">
        <section>
          <button
            type="button"
            onClick={() => setOrgOpen((prev) => !prev)}
            className="flex w-full items-center gap-2 rounded-md bg-background px-2.5 py-1.5 text-sm font-bold transition-colors hover:bg-accent"
          >
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${orgOpen ? "rotate-90" : ""}`} />
            <Building2 className="h-4 w-4 text-primary" />
            <span className="min-w-0 flex-1 truncate text-left">마포 미용실</span>
          </button>

          {orgOpen && (
            <div className="ml-4 mt-1.5 border-l border-border pl-2.5">
              <button
                type="button"
                onClick={() => setTeamOpen((prev) => !prev)}
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${teamOpen ? "rotate-90" : ""}`} />
                <span className="flex-1 text-left">상담팀</span>
                <span className="tabular-nums">{agents.length}</span>
              </button>

              {teamOpen &&
                (agents.length === 0 ? (
                  <p className="px-1.5 py-2.5 text-xs leading-5 text-muted-foreground">소프트폰 연결 후 실제 상담원이 표시됩니다.</p>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    {agents.map((agent) => (
                      <AgentTreeItem
                        key={agent.agentId}
                        agent={agent}
                        selected={agent.agentId === selectedAgentId}
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                ))}
            </div>
          )}
        </section>
      </nav>
    </aside>
  );
}

function AgentTreeItem({
  agent,
  selected,
  onSelect,
}: {
  agent: ConsultationAgentStatusResponse;
  selected: boolean;
  onSelect: (agentId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.agentId)}
      className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors ${
        selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_TONE[agent.status]}`} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-bold ${selected ? "text-primary" : ""}`}>{agent.agentName}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {agent.extension} · {STATUS_LABEL[agent.status]}
        </span>
      </span>
    </button>
  );
}

function ConnectionBadge({ state }: { state: "connecting" | "connected" | "fallback" }) {
  const label = state === "connected" ? "실시간 연결됨" : state === "connecting" ? "실시간 연결 중" : "REST 조회 모드";
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-semibold text-muted-foreground">
      <RefreshCw className={`h-3.5 w-3.5 ${state === "connecting" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "blue" | "emerald" | "violet" | "amber";
}) {
  const toneClass = {
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    violet: "bg-violet-500/10 text-violet-600",
    amber: "bg-amber-500/10 text-amber-600",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${toneClass}`}>{icon}</span>
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function AgentRow({
  agent,
  onSelect,
}: {
  agent: ConsultationAgentStatusResponse;
  onSelect: (agentId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(agent.agentId)}
      className="flex w-full items-start gap-2.5 p-3.5 text-left transition-colors hover:bg-accent"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <UserRound className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">{agent.agentName}</p>
          <span className="text-xs text-muted-foreground">{agent.extension}</span>
        </div>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {agent.message ?? STATUS_DETAIL[agent.status]}
        </p>
      </div>
      <StatusBadge status={agent.status} label={STATUS_LABEL[agent.status]} />
    </button>
  );
}

function CallRow({
  agent,
  onSelect,
}: {
  agent: ConsultationAgentStatusResponse;
  onSelect: (agentId: number) => void;
}) {
  const isOutbound = agent.direction === "OUTBOUND";
  const directionLabel = directionToLabel(agent.direction);

  return (
    <button
      type="button"
      onClick={() => onSelect(agent.agentId)}
      className="grid w-full gap-2 p-3.5 text-left transition-colors hover:bg-accent md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              isOutbound
                ? "border-blue-500/30 bg-blue-500/10 text-blue-600"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
            }`}
          >
            {isOutbound ? <PhoneOutgoing className="h-3 w-3" /> : <PhoneIncoming className="h-3 w-3" />}
            {directionLabel}
          </span>
          <p className="text-sm font-bold">{agent.phoneNumber ?? "전화번호 미확인"}</p>
          <p className={agent.status === "ERROR" ? "text-sm font-semibold text-red-600" : "text-sm text-muted-foreground"}>
            {STATUS_LABEL[agent.status]}
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{agent.agentName} / {agent.extension}</p>
      </div>
      <div className="text-sm text-muted-foreground">{formatUpdatedAt(agent.updatedAt)}</div>
    </button>
  );
}

function StatusBadge({ status, label }: { status: ConsultationAgentStatus; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-bold">
      <span className={`h-2 w-2 rounded-full ${STATUS_TONE[status]}`} />
      {label}
    </span>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center px-5 text-center">
      <Clock className="h-6 w-6 text-muted-foreground/40" />
      <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function directionToLabel(direction: ConsultationCallDirection | null) {
  if (direction === "OUTBOUND") return "발신";
  if (direction === "INBOUND") return "수신";
  return "상태";
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number) {
  if (!seconds || seconds <= 0) return "0초";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}

function formatCallTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const CALL_RESULT_TONE: Record<string, string> = {
  완료: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  부재중: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  오류: "border-red-500/30 bg-red-500/10 text-red-600",
};

function AgentDetailView({
  agentId,
  liveAgent,
  onBack,
}: {
  agentId: number;
  liveAgent: ConsultationAgentStatusResponse | null;
  onBack: () => void;
}) {
  const [data, setData] = useState<ConsultationAgentCallsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const liveStatus = liveAgent?.status ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    consultationApi
      .getAgentCalls(agentId)
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // 실시간 상태가 바뀌면(통화 종료 등) 이력/실적을 다시 불러온다.
  }, [agentId, liveStatus]);

  const status: ConsultationAgentStatus = liveAgent?.status ?? data?.status ?? "OFFLINE";
  const name = liveAgent?.agentName ?? data?.agentName ?? "상담원";
  const extension = liveAgent?.extension ?? data?.extension ?? "";
  const message = liveAgent?.message ?? data?.message ?? STATUS_DETAIL[status];
  const calls = data?.calls ?? [];

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        전체 개요
      </button>

      {/* 프로필 헤더 */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold tracking-tight">{name}</h2>
            <span className="text-xs text-muted-foreground">{extension}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{message}</p>
        </div>
        <StatusBadge status={status} label={STATUS_LABEL[status]} />
      </div>

      {/* 오늘 실적 KPI */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <MetricCard icon={<Phone className="h-4 w-4" />} label="오늘 통화" value={`${data?.totalCallsToday ?? 0}건`} tone="blue" />
        <MetricCard icon={<PhoneMissed className="h-4 w-4" />} label="부재중" value={`${data?.missedCallsToday ?? 0}건`} tone="amber" />
        <MetricCard icon={<Clock className="h-4 w-4" />} label="총 통화시간" value={formatDuration(data?.talkTimeSecondsToday ?? 0)} tone="emerald" />
        <MetricCard icon={<Timer className="h-4 w-4" />} label="평균 통화" value={formatDuration(data?.avgTalkTimeSecondsToday ?? 0)} tone="violet" />
      </div>

      {/* 최근 통화 이력 */}
      <div className="mt-4 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="text-base font-bold tracking-tight">최근 통화 이력</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">이 상담원의 최근 통화 기록입니다.</p>
          </div>
          <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            최근 {calls.length}건
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[140px] items-center justify-center text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            불러오는 중…
          </div>
        ) : calls.length === 0 ? (
          <EmptyState
            title="아직 통화 이력이 없습니다."
            description="이 상담원이 소프트폰으로 통화를 하면 여기에 자동으로 기록됩니다."
          />
        ) : (
          <div className="divide-y divide-border">
            {calls.map((call) => (
              <CallLogRow key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CallLogRow({ call }: { call: ConsultationCallLogResponse }) {
  const isOutbound = call.direction === "OUTBOUND";
  const tone = CALL_RESULT_TONE[call.result] ?? "border-border bg-muted text-muted-foreground";

  return (
    <div className="flex items-center gap-3 p-3.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          call.result === "부재중"
            ? "bg-amber-500/10 text-amber-600"
            : isOutbound
              ? "bg-blue-500/10 text-blue-600"
              : "bg-emerald-500/10 text-emerald-600"
        }`}
      >
        {call.result === "부재중" ? (
          <PhoneMissed className="h-4 w-4" />
        ) : isOutbound ? (
          <PhoneOutgoing className="h-4 w-4" />
        ) : (
          <PhoneIncoming className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{call.phoneNumber ?? "번호 미확인"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {directionToLabel(call.direction)} · {formatCallTime(call.endedAt)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
          {call.result}
        </span>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatDuration(call.durationSeconds)}</p>
      </div>
    </div>
  );
}
