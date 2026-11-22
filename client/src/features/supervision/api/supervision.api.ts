import { client } from "../../../lib/api/client";
import type { SupervisionTemplate } from "../lib/sheet-template";

/** لقطةُ ما وقّع عليه الأستاذ — تُقرأ ولا تُكتب من الواجهة. */
export interface SupervisionSnapshot {
  topicTitle: string;
  supervisorName: string;
  level: string;
  academicYear: string;
  specialization: string;
  students: { fullName: string; registrationNumber: string }[];
  issuedAt: string;
  /** The sheet's text as it was when the document was issued; none on older documents. */
  template?: SupervisionTemplate;
}

export interface SupervisionDocument {
  id: string;
  documentNumber: string;
  verificationToken: string;
  /** ثلاثة عشر رقماً (EAN-13) أسفل الورقة — يُمسح أو يُكتب باليد. */
  barcode: string | null;
  topicId: string;
  status: "active" | "revoked";
  /** Up to date with its topic and the sheet's text until the first print; fixed from then on. */
  snapshot: SupervisionSnapshot;
  createdAt: string;
  revokedAt: string | null;
  /** The first print — `null` while it was never printed. */
  printedAt: string | null;
  /** Who printed it first; the name is `null` for an employee of the administration, to anyone but the administration. */
  printedByRole: "admin" | "professor" | "student" | null;
  printedByName: string | null;
  printCount: number;
  lastPrintedAt: string | null;
  /** What the screen shows of it, in a word: the first print sends it back, and is refused (409) if it changed since. */
  version: string;
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

  /** The print window opened on it: the first print fixes it, and says who. */
  print: (id: string, version: string) =>
    client
      .post<{ document: SupervisionDocument }>(`${BASE}/${id}/print`, { version })
      .then((r) => r.data.document),

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
