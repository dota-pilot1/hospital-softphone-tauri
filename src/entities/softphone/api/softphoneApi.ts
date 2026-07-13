import { api } from "@/shared/api/axios";
import type { SoftphoneTokenResponse } from "../model/types";

export const softphoneApi = {
  issueToken: () =>
    api.post<SoftphoneTokenResponse>("/api/v1/softphone/token").then((r) => r.data),
};
