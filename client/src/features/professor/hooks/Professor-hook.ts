import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
  applications: (p?: object) => ["professor", "applications", p ?? {}] as const,
  groups: ["professor", "groups"] as const,
  group: (id: string) => ["professor", "group", id] as const,
  milestones: (gid: string) => ["professor", "milestones", gid] as const,
};

// ── Topics ──
export function useTopics() {
  return useQuery({ queryKey: KEYS.topics, queryFn: professorApi.listTopics });
}

export function useTopic(id: string) {
  return useQuery({
    queryKey: KEYS.topic(id),
    queryFn: () => professorApi.getTopic(id),
    enabled: !!id,
  });
}

export function useCreateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTopicInput) => professorApi.createTopic(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.topics });
      toast.success("تم إنشاء الموضوع");
    },
    onError: () => toast.error("تعذّر إنشاء الموضوع"),
  });
}

export function useUpdateTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTopicInput }) =>
      professorApi.updateTopic(id, data),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: KEYS.topics });
      qc.invalidateQueries({ queryKey: KEYS.topic(t.id) });
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
export function useApplications(params?: { topicId?: string; status?: string }) {
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
      qc.invalidateQueries({ queryKey: KEYS.topics });
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
      toast.success("تم رفض الطلب");
    },
    onError: () => toast.error("تعذّر رفض الطلب"),
  });
}

// ── Groups ──
export function useGroups() {
  return useQuery({ queryKey: KEYS.groups, queryFn: professorApi.listGroups });
}

// ── Milestones ──
export function useMilestones(groupId: string) {
  return useQuery({
    queryKey: KEYS.milestones(groupId),
    queryFn: () => professorApi.listMilestones(groupId),
    enabled: !!groupId,
  });
}

export function useCreateMilestone(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMilestoneInput) =>
      professorApi.createMilestone(groupId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.milestones(groupId) });
      toast.success("تمت إضافة المرحلة");
    },
    onError: () => toast.error("تعذّر إضافة المرحلة"),
  });
}

export function useUpdateMilestone(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMilestoneInput }) =>
      professorApi.updateMilestone(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.milestones(groupId) });
      toast.success("تم تحديث المرحلة");
    },
    onError: () => toast.error("تعذّر تحديث المرحلة"),
  });
}

export function useDeleteMilestone(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => professorApi.deleteMilestone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.milestones(groupId) });
      toast.success("تم حذف المرحلة");
    },
    onError: () => toast.error("تعذّر حذف المرحلة"),
  });
}