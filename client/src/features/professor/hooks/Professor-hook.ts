import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { professorApi } from "../api/professor.api";
import { serverMessage } from "../../../lib/api/error";
import { t } from "i18next";
import type {
  CreateTopicInput,
  UpdateTopicInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from "../validation/professor.schema";

const KEYS = {
  dashboard: ["professor", "dashboard"] as const,
  topics: ["professor", "topics"] as const,
  topic: (id: string) => ["professor", "topic", id] as const,
  groups: ["professor", "groups"] as const,
  group: (id: string) => ["professor", "group", id] as const,
  specializations: ["common", "specializations"] as const,
  academicYears: ["common", "academic-years"] as const,
  faculties: ["common", "faculties"] as const,
  studentSearch: (q: string, spec?: string) =>
    ["professor", "student-search", q, spec ?? ""] as const,
  departments: ["common", "departments"] as const,
  topicQuota: (yearId?: string) => ["professor", "topic-quota", yearId ?? ""] as const,
};

/** Every count of his topics: a topic sent, moved, resubmitted or deleted changes it. */
const QUOTA = ["professor", "topic-quota"] as const;

/** His limit for a year — the one given, else the current — and how much of it he has used. */
export function useProfessorTopicQuota(yearId?: string, enabled = true) {
  return useQuery({
    queryKey: KEYS.topicQuota(yearId),
    queryFn: () => professorApi.topicQuota(yearId),
    enabled,
  });
}

// ── Dashboard ──
export function useProfessorDashboard() {
  return useQuery({
    queryKey: KEYS.dashboard,
    queryFn: professorApi.getDashboard,
    // The screen reports deadlines, so it should not show yesterday's answer
    // after a milestone was ticked off in another tab.
    staleTime: 30 * 1000,
  });
}

// ── Lookups ──
export function useSpecializations() {
  return useQuery({
    queryKey: KEYS.specializations,
    queryFn: professorApi.listSpecializations,
    staleTime: 5 * 60 * 1000,
  });
}
export function useAcademicYears() {
  return useQuery({
    queryKey: KEYS.academicYears,
    queryFn: professorApi.listAcademicYears,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Debounce before calling this — every keystroke would otherwise be a query.
 * A letter is enough; and nothing typed, with a specialization, lists its
 * students — while the list is open (`enabled`).
 */
export function useSearchStudents(q: string, specializationId?: string, enabled = true) {
  return useQuery({
    queryKey: KEYS.studentSearch(q, specializationId),
    queryFn: () => professorApi.searchStudents(q, specializationId),
    enabled: enabled && (q.trim().length >= 1 || !!specializationId),
    staleTime: 60 * 1000,
  });
}

export function useFaculties() {
  return useQuery({
    queryKey: KEYS.faculties,
    queryFn: professorApi.listFaculties,
    staleTime: 5 * 60 * 1000,
  });
}
export function useDepartments() {
  return useQuery({
    queryKey: KEYS.departments,
    queryFn: professorApi.listDepartments,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Topics ──
export function useMyTopics() {
  return useQuery({ queryKey: KEYS.topics, queryFn: professorApi.listTopics });
}
export function useTopic(id: string | null) {
  return useQuery({
    queryKey: KEYS.topic(id as string),
    queryFn: () => professorApi.getTopic(id as string),
    enabled: !!id,
  });
}
export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTopicInput) => professorApi.createTopic(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.topics });
      qc.invalidateQueries({ queryKey: QUOTA });
      toast.success(t("toast.topicSentToAdmin"));
    },
    // The server's reason when it gives one — a closed period, the limit reached.
    onError: (e) => toast.error(serverMessage(e, t("toast.topicSendFailed"))),
  });
}
export function useCreateTopicWithGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: professorApi.createTopicWithGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.topics });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
      qc.invalidateQueries({ queryKey: QUOTA });
      toast.success(t("toast.topicProposedWithTeam"));
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.topicCreateFailed"));
    },
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTopicInput }) =>
      professorApi.updateTopic(id, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: KEYS.topics });
      qc.invalidateQueries({ queryKey: KEYS.topic(v.id) });
      qc.invalidateQueries({ queryKey: QUOTA });
      toast.success(t("admin.topicUpdated"));
    },
    onError: (e) => toast.error(serverMessage(e, t("toast.topicUpdateFailed"))),
  });
}
export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => professorApi.deleteTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.topics });
      qc.invalidateQueries({ queryKey: QUOTA });
      toast.success(t("toast.topicDeleted"));
    },
    onError: () => toast.error(t("toast.topicDeleteFailed")),
  });
}

// ── Groups + Milestones ──
export function useMyGroups() {
  return useQuery({ queryKey: KEYS.groups, queryFn: professorApi.listGroups });
}
export function useGroup(groupId: string | null) {
  return useQuery({
    queryKey: KEYS.group(groupId as string),
    queryFn: () => professorApi.getGroup(groupId as string),
    enabled: !!groupId,
  });
}
export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: string;
      data: CreateMilestoneInput;
    }) => professorApi.createMilestone(groupId, data),
    onSuccess: (_d, v) => {
      // المراحل جزءٌ من استعلام المجموعة نفسه.
      qc.invalidateQueries({ queryKey: KEYS.group(v.groupId) });
      toast.success(t("toast.milestoneAdded"));
    },
    onError: () => toast.error(t("toast.milestoneAddFailed")),
  });
}
export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMilestoneInput }) =>
      professorApi.updateMilestone(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professor", "group"] });
      toast.success(t("toast.milestoneUpdated"));
    },
    onError: () => toast.error(t("toast.milestoneUpdateFailed")),
  });
}
export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => professorApi.deleteMilestone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professor", "group"] });
      toast.success(t("toast.milestoneDeleted"));
    },
    onError: () => toast.error(t("toast.milestoneDeleteFailed")),
  });
}
