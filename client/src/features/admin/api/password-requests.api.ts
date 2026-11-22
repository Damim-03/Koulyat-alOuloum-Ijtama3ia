import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../../../lib/api/client";

/**
 * «نسيت كلمة المرور» of a student without a confirmed address, waiting for
 * the administration (Backend modules/password-request): the card's photo to
 * check, then a password to write — or a reason to refuse.
 */
export interface PasswordRequestItem {
  /** Student.id */
  id: string;
  registrationNumber: string;
  firstName: string | null;
  lastName: string | null;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  specialization: { name: string; level: string };
  /** As the student card prints them: «الميدان» and «الفرع». */
  domain: string | null;
  filiere: string;
  avatarUrl: string | null;
  academicYear: string;
  status: "active" | "suspended";
  /** The account was verified before (its card seen by the administration). */
  verified: boolean;
  lastLoginAt: string | null;
  sentAt: string;
  qrNumber: string | null;
  /** The number in the card's QR code is this account's — as the student's browser read it. */
  qrMatches: boolean | null;
  photo: boolean;
}

export type PasswordDecision =
  | { id: string; sentAt: string; decision: "approve"; password: string }
  | { id: string; sentAt: string; decision: "reject"; reason: string };

export const passwordRequestsApi = {
  list: () => client.get<{ items: PasswordRequestItem[]; total: number }>("/admin/password-requests").then((r) => r.data),
  /** The card's photo — private, so fetched with the session, never by a plain link. */
  photo: (id: string) => client.get<Blob>(`/admin/password-requests/${id}/card`, { responseType: "blob" }).then((r) => r.data),
  decide: (d: PasswordDecision) =>
    client
      .post<{ message: string }>(
        `/admin/password-requests/${d.id}/${d.decision}`,
        d.decision === "reject" ? { sentAt: d.sentAt, reason: d.reason } : { sentAt: d.sentAt, password: d.password },
      )
      .then((r) => r.data),
};

const KEY = ["admin", "password-requests"] as const;

/** The requests waiting — looked at again every minute while the page is open. */
export const usePasswordRequests = () => useQuery({ queryKey: KEY, queryFn: passwordRequestsApi.list, refetchInterval: 60_000 });

/** The card of a request, as an address the page can show; fetched once per request sent. */
export const usePasswordRequestPhoto = (id: string, sentAt: string) =>
  useQuery({
    queryKey: [...KEY, id, sentAt, "card"],
    queryFn: async () => URL.createObjectURL(await passwordRequestsApi.photo(id)),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

/** Write the password or refuse — then the list again, whatever the answer (another may have decided first). */
export const useDecidePasswordRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: passwordRequestsApi.decide,
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
