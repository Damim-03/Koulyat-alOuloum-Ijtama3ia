import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../../../lib/api/client";

/** The student whose card was scanned or number typed (Backend modules/admin/activation-desk). */
export interface DeskStudent {
  id: string;
  registrationNumber: string;
  firstName: string | null;
  lastName: string | null;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  specialization: { name: string; level: string };
  academicYear: string;
  status: "active" | "suspended";
  /** Chose a password of their own: the handed-out one is gone. */
  activated: boolean;
  lastLoginAt: string | null;
}

export interface DeskSettings {
  /** The handed-out password (a birth date) no longer opens an account. */
  required: boolean;
  /** Where the students stand — the page's header. */
  counts?: { students: number; notActivated: number; verified: number; suspended: number; pendingRequests: number };
}

/** Where a student stands, as the filter knows it. */
export type DeskState = "all" | "notActivated" | "activated" | "verified" | "unverified" | "requested" | "suspended";
export const DESK_STATES: DeskState[] = ["all", "notActivated", "activated", "verified", "unverified", "requested", "suspended"];

export interface DeskStudentsQuery {
  q?: string;
  state?: DeskState;
  specializationId?: string;
  academicYearId?: string;
  page?: number;
  limit?: number;
}

type Names = { firstName: string | null; lastName: string | null; firstNameLatin: string | null; lastNameLatin: string | null };

/** A student in the list. */
export interface DeskStudentRow extends Names {
  id: string;
  registrationNumber: string;
  gender: "male" | "female" | null;
  avatarUrl: string | null;
  specialization: { name: string; level: string };
  academicYear: string;
  status: "active" | "suspended";
  activated: boolean;
  verified: boolean;
  lastLoginAt: string | null;
  pendingRequest: { sentAt: string } | null;
}

type Person = Names & { registrationNumber: string };

/** Everything about a student, for the administration deciding on them (Backend activation-desk). */
export interface StudentProfile {
  id: string;
  registrationNumber: string;
  personal: Names & {
    userId: string;
    email: string | null;
    username: string | null;
    phone: string | null;
    gender: "male" | "female" | null;
    avatarUrl: string | null;
  };
  academic: {
    faculty: string;
    department: string;
    filiere: string;
    specialization: { name: string; level: string };
    academicYear: string;
    currentYear: boolean;
  };
  account: {
    status: "active" | "suspended";
    activated: boolean;
    verified: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    devices: number;
    request: {
      status: "pending" | "rejected";
      sentAt: string;
      rejectionReason: string | null;
      decidedAt: string | null;
    } | null;
  };
  requests: {
    id: string;
    role: "leader" | "member";
    status: "pending" | "accepted" | "rejected";
    priority: number;
    createdAt: string;
    rejectionReason: string | null;
    topic: { id: string; title: string; status: string; supervisor: Names };
    team: Person[];
  }[];
  project: {
    id: string;
    leader: boolean;
    topic: { id: string; title: string; supervisor: Names };
    defense: { date: string; room: string; grade: number | null; status: string } | null;
    milestones: { total: number; completed: number; overdue: number };
    team: (Person & { leader: boolean })[];
  } | null;
  activity: { id: string; action: string; success: boolean; createdAt: string; ip: string | null; userAgent: string | null }[];
}

/** A request with photos, waiting (Backend modules/activation). */
export interface ActivationRequestItem {
  /** Student.id */
  id: string;
  registrationNumber: string;
  firstName: string | null;
  lastName: string | null;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  specialization: { name: string; level: string };
  academicYear: string;
  status: "active" | "suspended";
  sentAt: string;
  qrNumber: string | null;
  /** The number in the card's QR code is this account's — as the student's browser read it. */
  qrMatches: boolean | null;
  /** Which photos came with it — an activation may come with fewer than two, or none. */
  photos: { card: boolean; selfie: boolean };
}

export type ActivationDecision =
  | { id: string; sentAt: string; decision: "approve" }
  | { id: string; sentAt: string; decision: "reject"; reason: string };

export const activationApi = {
  students: (params: DeskStudentsQuery) =>
    client
      .get<{ items: DeskStudentRow[]; total: number; page: number; limit: number }>("/admin/activation/students", { params })
      .then((r) => r.data),
  profile: (id: string) => client.get<StudentProfile>(`/admin/activation/students/${id}`).then((r) => r.data),
  requests: () =>
    client.get<{ items: ActivationRequestItem[]; total: number }>("/admin/activation/requests").then((r) => r.data),
  /** One of the two photos — private, so fetched with the session, never by a plain link. */
  photo: (id: string, which: "card" | "selfie") =>
    client.get<Blob>(`/admin/activation/requests/${id}/${which}`, { responseType: "blob" }).then((r) => r.data),
  decide: (d: ActivationDecision) =>
    client
      .post<{ message: string }>(
        `/admin/activation/requests/${d.id}/${d.decision}`,
        d.decision === "reject" ? { sentAt: d.sentAt, reason: d.reason } : { sentAt: d.sentAt },
      )
      .then((r) => r.data),
  settings: () => client.get<DeskSettings>("/admin/activation/settings").then((r) => r.data),
  lookup: (registrationNumber: string) =>
    client.get<DeskStudent>("/admin/activation/student", { params: { registrationNumber } }).then((r) => r.data),
};

export const useDeskSettings = () =>
  useQuery({ queryKey: ["admin", "activation", "settings"], queryFn: activationApi.settings, staleTime: 60_000 });

/** The students the filter finds — the previous page stays while the next loads. */
export const useDeskStudents = (params: DeskStudentsQuery) =>
  useQuery({
    queryKey: ["admin", "activation", "students", params],
    queryFn: () => activationApi.students(params),
    placeholderData: keepPreviousData,
  });

/** Everything about one student. */
export const useStudentProfile = (id: string | null) =>
  useQuery({
    queryKey: ["admin", "activation", "profile", id],
    queryFn: () => activationApi.profile(id!),
    enabled: !!id,
  });

/** A card scanned, or a number typed: an action, not a page of data — so a mutation. */
export const useDeskLookup = () => useMutation({ mutationFn: activationApi.lookup });

const REQUESTS = ["admin", "activation", "requests"] as const;

/** The requests waiting — looked at again every minute while the page is open. */
export const useActivationRequests = () =>
  useQuery({ queryKey: REQUESTS, queryFn: activationApi.requests, refetchInterval: 60_000 });

/**
 * A photo of a request, as an address the page can show. Fetched once per
 * request sent (`sentAt`), dropped as soon as nothing shows it.
 */
export const useActivationPhoto = (id: string, sentAt: string, which: "card" | "selfie") =>
  useQuery({
    queryKey: [...REQUESTS, id, sentAt, which],
    queryFn: async () => URL.createObjectURL(await activationApi.photo(id, which)),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

/** Accept or refuse — then the list again, whatever the answer (another may have decided first). */
export const useDecideActivation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: activationApi.decide,
    onSettled: () => qc.invalidateQueries({ queryKey: REQUESTS }),
  });
};
