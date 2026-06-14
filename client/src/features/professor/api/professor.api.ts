import { client } from "../../../lib/api/client";
import type {
  Topic,
  Application,
  ProjectGroup,
  Milestone,
  SpecializationLite,
  AcademicYearLite,
} from "../../../types/professor.types";
import type {
  CreateTopicInput,
  UpdateTopicInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from "../validation/professor.schema";

const BASE = "/professor";

export const professorApi = {
  // ── Topics ──
  listTopics: () =>
    client.get<{ topics: Topic[] }>(`${BASE}/topics`).then((r) => r.data.topics),
  getTopic: (id: string) =>
    client.get<{ topic: Topic }>(`${BASE}/topics/${id}`).then((r) => r.data.topic),
  createTopic: (data: CreateTopicInput) =>
    client.post<{ topic: Topic }>(`${BASE}/topics`, data).then((r) => r.data.topic),
  updateTopic: (id: string, data: UpdateTopicInput) =>
    client.put<{ topic: Topic }>(`${BASE}/topics/${id}`, data).then((r) => r.data.topic),
  deleteTopic: (id: string) =>
    client.delete(`${BASE}/topics/${id}`).then((r) => r.data),

  // ── Applications ──
  listApplications: (params?: { topicId?: string; status?: string }) =>
    client
      .get<{ applications: Application[] }>(`${BASE}/applications`, { params })
      .then((r) => r.data.applications),
  acceptApplication: (id: string) =>
    client
      .patch<{ application: Application }>(`${BASE}/applications/${id}/accept`)
      .then((r) => r.data.application),
  rejectApplication: (id: string) =>
    client
      .patch<{ application: Application }>(`${BASE}/applications/${id}/reject`)
      .then((r) => r.data.application),

  // ── Groups ──
  listGroups: () =>
    client.get<{ groups: ProjectGroup[] }>(`${BASE}/groups`).then((r) => r.data.groups),
  getGroup: (groupId: string) =>
    client
      .get<{ group: ProjectGroup }>(`${BASE}/groups/${groupId}`)
      .then((r) => r.data.group),

  // ── Milestones ──
  listMilestones: (groupId: string) =>
    client
      .get<{ milestones: Milestone[] }>(`${BASE}/groups/${groupId}/milestones`)
      .then((r) => r.data.milestones),
  createMilestone: (groupId: string, data: CreateMilestoneInput) =>
    client
      .post<{ milestone: Milestone }>(`${BASE}/groups/${groupId}/milestones`, data)
      .then((r) => r.data.milestone),
  updateMilestone: (id: string, data: UpdateMilestoneInput) =>
    client
      .put<{ milestone: Milestone }>(`${BASE}/milestones/${id}`, data)
      .then((r) => r.data.milestone),
  deleteMilestone: (id: string) =>
    client.delete(`${BASE}/milestones/${id}`).then((r) => r.data),

  // ── Common lookups (form dropdowns) — hit /common/*, NOT /professor ──
  listSpecializations: () =>
    client
      .get<{ specializations: SpecializationLite[] }>(`/common/specializations`)
      .then((r) => r.data.specializations),
  listAcademicYears: () =>
    client
      .get<{ academicYears: AcademicYearLite[] }>(`/common/academic-years`)
      .then((r) => r.data.academicYears),
};