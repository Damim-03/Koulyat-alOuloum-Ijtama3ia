import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { studentApi } from "../api/Student-api";
import type { CreateGroupRequestInput } from "../validation/student.schema";
import { t } from "i18next";
import { serverMessage } from "../../../lib/api/error";

const KEYS = {
  dashboard: ["student", "dashboard"] as const,
  lookup: (reg: string) => ["student", "lookup", reg] as const,
  requests: ["student", "group-requests"] as const,
  project: ["student", "my-project"] as const,
  selection: ["student", "selection-window"] as const,
};

// ─── the deadline to choose topics ─────────────────────────────
/** The deadline for the student's own year: its days; the page reads where it stands by the clock. */
export function useStudentSelectionWindow(enabled = true) {
  return useQuery({ queryKey: KEYS.selection, queryFn: studentApi.selectionWindow, staleTime: 60_000, enabled });
}

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
    // والرفضُ لا يُعلَن هنا: نافذة الطلب تعرضه في مكانه، فوق زرّ الإرسال.
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
    // Past the deadline the server says why it stays: said as it is.
    onError: (e) => toast.error(serverMessage(e, t("toast.requestCancelFailed"))),
  });
}

// ─── my project ────────────────────────────────────────────────
/** The student's project, once a request was accepted — off for anyone who is not a student. */
export function useMyProject(enabled = true) {
  return useQuery({ queryKey: KEYS.project, queryFn: studentApi.myProject, enabled });
}
