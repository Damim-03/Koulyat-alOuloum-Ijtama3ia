import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { professorApi } from "../api/professor.api";
import type {
  CreateTopicInput,
  UpdateTopicInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from "../validation/professor.schema";

const KEYS = {
  topics: ["professor", "topics"] as const,
  topic: (id: string) => ["professor", "topic", id] as const,
  applications: (p?: { topicId?: string; status?: string }) =>
    ["professor", "applications", p ?? {}] as const,
  groups: ["professor", "groups"] as const,
  group: (id: string) => ["professor", "group", id] as const,
  milestones: (groupId: string) =>
    ["professor", "milestones", groupId] as const,
  specializations: ["common", "specializations"] as const,
  academicYears: ["common", "academic-years"] as const,
};

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
      toast.success("تم إرسال الموضوع إلى الإدارة للمراجعة");
    },
    onError: () => toast.error("تعذّر إرسال الموضوع"),
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
      toast.success("تم تحديث الموضوع");
    },
    onError: () => toast.error("تعذّر تحديث الموضوع"),
  });
}
export function useDeleteTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => professorApi.deleteTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.topics });
      toast.success("تم حذف الموضوع");
    },
    onError: () => toast.error("تعذّر حذف الموضوع"),
  });
}

// ── Applications ──
export function useApplications(params?: {
  topicId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: KEYS.applications(params),
    queryFn: () => professorApi.listApplications(params),
  });
}
export function useAcceptApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => professorApi.acceptApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professor", "applications"] });
      qc.invalidateQueries({ queryKey: ["professor", "topic"] });
      qc.invalidateQueries({ queryKey: KEYS.groups });
      toast.success("تم قبول الطلب");
    },
    onError: () => toast.error("تعذّر قبول الطلب"),
  });
}
export function useRejectApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => professorApi.rejectApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professor", "applications"] });
      qc.invalidateQueries({ queryKey: ["professor", "topic"] });
      toast.success("تم رفض الطلب");
    },
    onError: () => toast.error("تعذّر رفض الطلب"),
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
      qc.invalidateQueries({ queryKey: KEYS.group(v.groupId) });
      qc.invalidateQueries({ queryKey: KEYS.milestones(v.groupId) });
      toast.success("تمت إضافة المرحلة");
    },
    onError: () => toast.error("تعذّرت إضافة المرحلة"),
  });
}
export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMilestoneInput }) =>
      professorApi.updateMilestone(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professor", "group"] });
      toast.success("تم تحديث المرحلة");
    },
    onError: () => toast.error("تعذّر تحديث المرحلة"),
  });
}
export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => professorApi.deleteMilestone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professor", "group"] });
      toast.success("تم حذف المرحلة");
    },
    onError: () => toast.error("تعذّر حذف المرحلة"),
  });
}
