import { client } from "../../../lib/api/client";
import type {
  GroupRequest,
  MyProject,
  LookupStudent,
  StudentDashboard,
} from "../../../types/student.types";
import type { CreateGroupRequestInput } from "../validation/student.schema";

const BASE = "/student";

export const studentApi = {
  // ── Dashboard — one read for the whole first screen ──
  getDashboard: () =>
    client.get<StudentDashboard>(`${BASE}/dashboard`).then((r) => r.data),

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
};
