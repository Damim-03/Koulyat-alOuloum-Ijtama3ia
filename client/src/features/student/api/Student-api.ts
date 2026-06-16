import { client } from "../../../lib/api/client";
import type {
  BrowseTopic,
  GroupRequest,
  MyProject,
  SpecializationLite,
  AcademicYearLite,
  LookupStudent,
} from "../../../types/student.types";
import type { CreateGroupRequestInput } from "../validation/student.schema";

const BASE = "/student";

export const studentApi = {
  // ── Browse published topics ──
  browseTopics: (params?: {
    specializationId?: string;
    academicYearId?: string;
    search?: string;
  }) =>
    client
      .get<{ topics: BrowseTopic[] }>(`${BASE}/topics`, { params })
      .then((r) => r.data.topics ?? []),

  getTopic: (id: string) =>
    client
      .get<{ topic: BrowseTopic }>(`${BASE}/topics/${id}`)
      .then((r) => r.data.topic ?? null),

  // ── Lookup a student by registration number (live search in the dialog) ──
  lookupStudent: (registration: string) =>
    client
      .get<{ student: LookupStudent | null }>(`${BASE}/students/lookup`, {
        params: { registration },
      })
      .then((r) => r.data.student ?? null),

  // ── Group requests (assemble team + submit to admin) ──
  createGroupRequest: (data: CreateGroupRequestInput) =>
    client
      .post<{ request: GroupRequest }>(`${BASE}/group-requests`, data)
      .then((r) => r.data.request),

  myGroupRequests: () =>
    client
      .get<{ requests: GroupRequest[] }>(`${BASE}/group-requests`)
      .then((r) => r.data.requests ?? []),

  cancelGroupRequest: (id: string) =>
    client.delete(`${BASE}/group-requests/${id}`).then((r) => r.data ?? null),

  // ── My project (after acceptance) ──
  myProject: () =>
    client
      .get<{ project: MyProject | null }>(`${BASE}/my-project`)
      .then((r) => r.data.project ?? null),

  // ── Common lookups (shared module — for dropdowns/filters) ──
  listSpecializations: () =>
    client
      .get<{ specializations: SpecializationLite[] }>(`/common/specializations`)
      .then((r) => r.data.specializations ?? []),

  listAcademicYears: () =>
    client
      .get<{ academicYears: AcademicYearLite[] }>(`/common/academic-years`)
      .then((r) => r.data.academicYears ?? []),
};
