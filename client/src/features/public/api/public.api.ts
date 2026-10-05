import { client } from "../../../lib/api/client";
import type {
  PublicTopicsPage,
  PublicTopicDetail,
  PublicTopicFilters,
  PublicLookup,
} from "../../../types/public.types";

const BASE = "/public";

export type PublicTopicsSort = "newest" | "oldest" | "title";

export interface PublicTopicsParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  specializationId?: string;
  academicYearId?: string;
  professorId?: string;
  maxStudents?: number;
  availability?: "available" | "reserved";
  sort?: PublicTopicsSort;
  [key: string]: unknown;
}

export const publicApi = {
  listTopics: (params?: PublicTopicsParams) =>
    client
      .get<PublicTopicsPage>(`${BASE}/topics`, { params })
      .then((r) => r.data),

  getTopicFilters: () =>
    client.get<PublicTopicFilters>(`${BASE}/topic-filters`).then((r) => r.data),

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
