import { api } from "@/shared/api/axios";
import { tokenStorage } from "@/shared/api/tokenStorage";
import { getApiBaseUrl } from "@/shared/api/apiEnvironment";
import type {
  ConsultationAgentCallsResponse,
  ConsultationAgentStatusResponse,
  UpdateConsultationAgentStatusRequest,
} from "../model/types";

export const consultationApi = {
  listAgents: () =>
    api.get<ConsultationAgentStatusResponse[]>("/api/v1/consultation/agents").then((r) => r.data),

  updateMyStatus: (request: UpdateConsultationAgentStatusRequest) =>
    api.patch<ConsultationAgentStatusResponse>("/api/v1/consultation/agents/me/status", request).then((r) => r.data),

  getAgentCalls: (agentId: number, limit = 20) =>
    api
      .get<ConsultationAgentCallsResponse>(`/api/v1/consultation/agents/${agentId}/calls`, { params: { limit } })
      .then((r) => r.data),
};

export function createConsultationStatusWebSocket(): WebSocket | null {
  const token = tokenStorage.getAccess();
  if (!token) return null;

  const baseUrl = getApiBaseUrl();
  const url = new URL("/ws/consultation-status", baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("access_token", token);
  return new WebSocket(url.toString());
}
