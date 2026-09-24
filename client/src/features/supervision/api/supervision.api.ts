import { client } from "../../../lib/api/client";

/** لقطةُ ما وقّع عليه الأستاذ — تُقرأ ولا تُكتب من الواجهة. */
export interface SupervisionSnapshot {
  topicTitle: string;
  supervisorName: string;
  level: string;
  academicYear: string;
  specialization: string;
  students: { fullName: string; registrationNumber: string }[];
  issuedAt: string;
}

export interface SupervisionDocument {
  id: string;
  documentNumber: string;
  verificationToken: string;
  /** ثلاثة عشر رقماً (EAN-13) أسفل الورقة — يُمسح أو يُكتب باليد. */
  barcode: string | null;
  topicId: string;
  status: "active" | "revoked";
  snapshot: SupervisionSnapshot;
  createdAt: string;
  revokedAt: string | null;
}

export interface VerificationResult {
  found: boolean;
  status?: "active" | "revoked";
  documentNumber?: string;
  barcode?: string | null;
  issuedAt?: string;
  revokedAt?: string | null;
  topicTitle?: string;
  supervisorName?: string;
  level?: string;
  academicYear?: string;
  students?: { fullName: string; registrationNumber: string }[];
}

const BASE = "/supervision-documents";

export const supervisionApi = {
  /** ما ستحمله الورقة، بلا إصدار. */
  preview: (topicId: string) =>
    client
      .get<{ snapshot: SupervisionSnapshot; active: SupervisionDocument | null }>(
        `${BASE}/topics/${topicId}/preview`,
      )
      .then((r) => r.data),

  issue: (topicId: string) =>
    client
      .post<{ document: SupervisionDocument; created: boolean }>(
        `${BASE}/topics/${topicId}`,
      )
      .then((r) => r.data),

  get: (id: string) =>
    client
      .get<{ document: SupervisionDocument }>(`${BASE}/${id}`)
      .then((r) => r.data.document),

  list: (params?: {
    page?: number;
    limit?: number;
    status?: "active" | "revoked";
    search?: string;
  }) =>
    client
      .get<{
        items: SupervisionDocument[];
        total: number;
        page: number;
        limit: number;
      }>(BASE, { params })
      .then((r) => r.data),

  revoke: (id: string) =>
    client
      .patch<{ document: SupervisionDocument }>(`${BASE}/${id}/revoke`)
      .then((r) => r.data.document),

  /**
   * التحقّق العامّ — بلا تسجيل دخول.
   *
   * و٤٠٤ هنا جوابٌ صحيح لا عُطل: «لا وثيقة بهذا الرمز». فيُلتقط ويُترجم
   * إلى `found: false` بدل أن يُرمى كخطأ شبكة.
   */
  verify: (token: string) =>
    client
      .get<VerificationResult>(`/verify/${encodeURIComponent(token)}`)
      .then((r) => r.data)
      .catch((e: { response?: { status?: number; data?: VerificationResult } }) => {
        if (e.response?.status === 404)
          return e.response.data ?? { found: false };
        throw e;
      }),
};
