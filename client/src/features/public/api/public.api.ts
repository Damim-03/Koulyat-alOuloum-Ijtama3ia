import { client } from "../../../lib/api/client";
import type {
  PublicTopic,
  PublicTopicDetail,
  PublicLookup,
  Paginated,
} from "../../../types/public.types";

const BASE = "/public";

export interface PublicTopicsParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  specializationId?: string;
  academicYearId?: string;
  availability?: "available" | "reserved";
  [key: string]: unknown;
}

export const publicApi = {
  listTopics: (params?: PublicTopicsParams) =>
    client
      .get<Paginated<PublicTopic>>(`${BASE}/topics`, { params })
      .then((r) => r.data),

  getTopic: (id: string) =>
    client
      .get<{ topic: PublicTopicDetail }>(`${BASE}/topics/${id}`)
      .then((r) => r.data.topic),

  listDepartments: () =>
    client
      .get<{ departments: PublicLookup[] }>(`${BASE}/departments`)
      .then((r) => r.data.departments),

  listSpecializations: (departmentId?: string) =>
    client
      .get<{ specializations: PublicLookup[] }>(`${BASE}/specializations`, {
        params: departmentId ? { departmentId } : undefined,
      })
      .then((r) => r.data.specializations),
};
