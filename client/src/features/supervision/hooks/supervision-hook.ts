import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supervisionApi } from "../api/supervision.api";

const KEYS = {
  all: ["supervision-documents"] as const,
  list: (p?: unknown) => ["supervision-documents", "list", p] as const,
  preview: (topicId: string | null) =>
    ["supervision-documents", "preview", topicId] as const,
  verify: (token: string | null) =>
    ["supervision-documents", "verify", token] as const,
};

/** ما ستحمله الورقة لموضوعٍ بعينه، ومعه الوثيقة الفعّالة إن وُجدت. */
export function useSupervisionPreview(topicId: string | null) {
  return useQuery({
    queryKey: KEYS.preview(topicId),
    queryFn: () => supervisionApi.preview(topicId as string),
    enabled: !!topicId,
    // لا تُعاد المحاولة على ٤٠١/٤٠٠: «لست عضواً» و«لا مجموعة بعد» جوابان
    // نهائيّان، وتكرارُهما يُبطئ الشاشة بلا فائدة.
    retry: false,
  });
}

export function useIssueSupervisionDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (topicId: string) => supervisionApi.issue(topicId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useSupervisionDocuments(params?: {
  page?: number;
  limit?: number;
  status?: "active" | "revoked";
  search?: string;
}) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => supervisionApi.list(params),
  });
}

export function useRevokeSupervisionDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supervisionApi.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

/**
 * ورقةٌ بعينها من رمزها الشريطيّ — للإدارة.
 *
 * ولا تكتفي بصفحة التحقّق العامّة لأنّ تلك لا تُعيد معرّف الموضوع عمداً،
 * وهذه الشاشة تفتحه. والبحث `contains` فقد يلتقط رقم وثيقةٍ فيه الأرقام
 * نفسها، فتُطابَق النتيجة على الرمز حرفاً بحرف قبل أن تُعرض.
 */
export function useSupervisionByCode(code: string | null) {
  return useQuery({
    queryKey: ["supervision-documents", "by-code", code] as const,
    queryFn: async () => {
      const { items } = await supervisionApi.list({ search: code as string, limit: 5 });
      return items.find((d) => d.barcode === code) ?? null;
    },
    enabled: !!code,
    retry: false,
  });
}

/** صفحة التحقّق العامّة — بلا تسجيل دخول. */
export function useVerifyDocument(token: string | null) {
  return useQuery({
    queryKey: KEYS.verify(token),
    queryFn: () => supervisionApi.verify(token as string),
    enabled: !!token,
    retry: false,
  });
}
