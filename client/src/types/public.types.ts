// Shapes returned by the public (no-auth) topics endpoints.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PublicLookup {
  id: string;
  name: string;
  departmentId?: string;
}

interface PublicProfessor {
  id: string;
  /** Academic rank, stored as JSON: usually a list, sometimes one string. */
  grade?: unknown;
  user?: {
    firstName: string | null;
    lastName: string | null;
    avatarUrl?: string | null;
    gender?: string | null;
  } | null;
  department?: {
    name: string;
    faculty?: { name: string } | null;
  } | null;
}

export interface PublicTopic {
  id: string;
  title: string;
  description: string;
  status: "open" | "full";
  maxStudents: number;
  createdAt: string;
  isAvailable: boolean;
  /** Taken by a team whose request is live, even while the status is `open`. */
  isReserved?: boolean;
  /** محجوزٌ لفريق القارئ نفسه — يفتحه، ويُغلق على الطلبة من غيره. */
  isMine?: boolean;
  specialization?: {
    id: string;
    name: string;
    level?: "licence" | "master" | "doctorate";
  } | null;
  academicYear?: { id: string; title: string } | null;
  professor?: PublicProfessor | null;
  /** When the administration published it — on the detail response. */
  publishedAt?: string | null;
}

/** القائمة ومعها عدّادات التبويبات — محسوبةً بفلاتر القارئ لا بالتبويب. */
export interface PublicTopicsPage extends Paginated<PublicTopic> {
  counts?: { all: number; available: number; reserved: number };
}

/** خيارات الفلاتر، من المنشور وحده ومع أعدادها. */
export interface PublicTopicFilters {
  professors: {
    id: string;
    user: PublicProfessor["user"];
    count: number;
  }[];
  academicYears: {
    id: string;
    title: string;
    isActive: boolean;
    count: number;
  }[];
  sizes: { value: number; count: number }[];
  /** للطالب وحده: تخصّصه وسنته، لزرّ «تخصّصي». */
  mine: {
    specializationId: string;
    specializationName: string;
    departmentId: string;
    academicYearId: string;
  } | null;
}

export interface PublicTopicDetail extends PublicTopic {
  requirements?: string[];
  objectives?: string[];
  // references?: { title: string; url: string }[]; // بعد migration
}
