export type ConsultationAgentStatus =
  | "OFFLINE"
  | "ONLINE"
  | "AVAILABLE"
  | "RINGING"
  | "IN_CALL"
  | "AFTER_CALL"
  | "ERROR";

export type ConsultationCallDirection = "INBOUND" | "OUTBOUND";

export type ConsultationAgentStatusResponse = {
  agentId: number;
  agentName: string;
  agentIdentity: string;
  extension: string;
  status: ConsultationAgentStatus;
  statusLabel: string;
  direction: ConsultationCallDirection | null;
  phoneNumber: string | null;
  callSid: string | null;
  message: string | null;
  updatedAt: string;
};

export type ConsultationStatusSnapshotResponse = {
  type: "SNAPSHOT";
  agents: ConsultationAgentStatusResponse[];
};

export type UpdateConsultationAgentStatusRequest = {
  status: ConsultationAgentStatus;
  direction?: ConsultationCallDirection | null;
  phoneNumber?: string | null;
  callSid?: string | null;
  message?: string | null;
};

export type ConsultationCallLogResponse = {
  id: number;
  direction: ConsultationCallDirection | null;
  phoneNumber: string | null;
  result: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
};

export type ConsultationAgentCallsResponse = {
  agentId: number;
  agentName: string | null;
  extension: string;
  status: ConsultationAgentStatus;
  statusLabel: string;
  message: string | null;
  totalCallsToday: number;
  connectedCallsToday: number;
  missedCallsToday: number;
  talkTimeSecondsToday: number;
  avgTalkTimeSecondsToday: number;
  calls: ConsultationCallLogResponse[];
};
