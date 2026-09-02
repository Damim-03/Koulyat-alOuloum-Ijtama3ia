import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { studentApi } from "../api/Student-api";
import type { CreateGroupRequestInput } from "../validation/student.schema";
import { t } from "i18next";

const KEYS = {
  topics: (p?: object) => ["student", "topics", p ?? {}] as const,
  topic: (id: string) => ["student", "topic", id] as const,
  lookup: (reg: string) => ["student", "lookup", reg] as const,
  requests: ["student", "group-requests"] as const,
  project: ["student", "my-project"] as const,
  specializations: ["common", "specializations"] as const,
  academicYears: ["common", "academic-years"] as const,
};

// ─── lookups (dropdowns/filters) ───────────────────────────────
export function useSpecializations() {
  return useQuery({
    queryKey: KEYS.specializations,
    queryFn: studentApi.listSpecializations,
    staleTime: 5 * 60 * 1000,
  });
}
export function useAcademicYears() {
  return useQuery({
    queryKey: KEYS.academicYears,
    queryFn: studentApi.listAcademicYears,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── browse topics ─────────────────────────────────────────────
export function useBrowseTopics(params?: {
  specializationId?: string;
  academicYearId?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: KEYS.topics(params),
    queryFn: () => studentApi.browseTopics(params),
  });
}
export function useTopic(id: string | null) {
  return useQuery({
    queryKey: KEYS.topic(id as string),
    queryFn: () => studentApi.getTopic(id as string),
    enabled: !!id,
  });
}

// ─── student lookup (live teammate search) ─────────────────────
export function useStudentLookup(reg: string) {
  return useQuery({
    queryKey: KEYS.lookup(reg.trim()),
    queryFn: () => studentApi.lookupStudent(reg.trim()),
    enabled: reg.trim().length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─── group requests ────────────────────────────────────────────
export function useMyGroupRequests() {
  return useQuery({
    queryKey: KEYS.requests,
    queryFn: studentApi.myGroupRequests,
  });
}
export function useCreateGroupRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupRequestInput) =>
      studentApi.createGroupRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.requests });
      toast.success(t("toast.groupRequestSent"));
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || t("toast.requestSendFailed"));
    },
  });
}
export function useCancelGroupRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studentApi.cancelGroupRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.requests });
      toast.success(t("toast.requestCancelled"));
    },
    onError: () => toast.error(t("toast.requestCancelFailed")),
  });
}

// ─── my project ────────────────────────────────────────────────
export function useMyProject() {
  return useQuery({ queryKey: KEYS.project, queryFn: studentApi.myProject });
}
