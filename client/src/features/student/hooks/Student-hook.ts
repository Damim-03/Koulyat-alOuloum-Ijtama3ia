import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { studentApi } from "../api/Student-api";
import type { CreateGroupRequestInput } from "../validation/student.schema";
import { t } from "i18next";

const KEYS = {
  dashboard: ["student", "dashboard"] as const,
  lookup: (reg: string) => ["student", "lookup", reg] as const,
  requests: ["student", "group-requests"] as const,
  project: ["student", "my-project"] as const,
};

// ─── dashboard ─────────────────────────────────────────────────
export function useStudentDashboard() {
  return useQuery({
    queryKey: KEYS.dashboard,
    queryFn: studentApi.getDashboard,
    // Deadlines are on this screen; a milestone ticked off elsewhere should
    // not keep showing as due.
    staleTime: 30 * 1000,
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
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
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
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
      toast.success(t("toast.requestCancelled"));
    },
    onError: () => toast.error(t("toast.requestCancelFailed")),
  });
}

// ─── my project ────────────────────────────────────────────────
export function useMyProject() {
  return useQuery({ queryKey: KEYS.project, queryFn: studentApi.myProject });
}
