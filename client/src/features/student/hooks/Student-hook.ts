import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { studentApi } from "../api/Student-api";

const KEYS = {
  topics: ["student", "topics"] as const,
  applications: ["student", "applications"] as const,
  project: ["student", "project"] as const,
  milestones: ["student", "milestones"] as const,
  files: ["student", "files"] as const,
  meetings: ["student", "meetings"] as const,
  defense: ["student", "defense"] as const,
};

// ─── topics ────────────────────────────────────────────────────
export function useBrowseTopics() {
  return useQuery({ queryKey: KEYS.topics, queryFn: studentApi.getTopics });
}

export function useApplyToTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { topicId: string; priority: number }) => studentApi.apply(payload),
    onSuccess: () => {
      toast.success("تم إرسال طلبك بنجاح");
      qc.invalidateQueries({ queryKey: KEYS.topics });
      qc.invalidateQueries({ queryKey: KEYS.applications });
    },
    onError: () => toast.error("تعذّر إرسال الطلب"),
  });
}

// ─── applications ──────────────────────────────────────────────
export function useStudentApplications() {
  return useQuery({ queryKey: KEYS.applications, queryFn: studentApi.getApplications });
}

export function useCancelApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studentApi.cancelApplication(id),
    onSuccess: () => {
      toast.success("تم إلغاء الطلب");
      qc.invalidateQueries({ queryKey: KEYS.applications });
      qc.invalidateQueries({ queryKey: KEYS.topics });
    },
    onError: () => toast.error("تعذّر إلغاء الطلب"),
  });
}

// ─── project ───────────────────────────────────────────────────
export function useStudentProject() {
  return useQuery({ queryKey: KEYS.project, queryFn: studentApi.getProject });
}

export function useStudentMilestones() {
  return useQuery({ queryKey: KEYS.milestones, queryFn: studentApi.getMilestones });
}

// ─── files ─────────────────────────────────────────────────────
export function useProjectFiles() {
  return useQuery({ queryKey: KEYS.files, queryFn: studentApi.getFiles });
}

export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => studentApi.uploadFile(file),
    onSuccess: () => {
      toast.success("تم رفع الملف");
      qc.invalidateQueries({ queryKey: KEYS.files });
    },
    onError: () => toast.error("تعذّر رفع الملف"),
  });
}

// ─── meetings ──────────────────────────────────────────────────
export function useMeetings() {
  return useQuery({ queryKey: KEYS.meetings, queryFn: studentApi.getMeetings });
}

export function useRequestMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      subject: string;
      date: string;
      duration: string;
      mode: "in_person" | "online";
      note?: string;
    }) => studentApi.requestMeeting(payload),
    onSuccess: () => {
      toast.success("تم إرسال طلب الاجتماع");
      qc.invalidateQueries({ queryKey: KEYS.meetings });
    },
    onError: () => toast.error("تعذّر إرسال الطلب"),
  });
}

// ─── defense ───────────────────────────────────────────────────
export function useDefense() {
  return useQuery({ queryKey: KEYS.defense, queryFn: studentApi.getDefense });
}
