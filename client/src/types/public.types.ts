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
  user?: { firstName: string | null; lastName: string | null } | null;
}

export interface PublicTopic {
  id: string;
  title: string;
  description: string;
  status: "open" | "full";
  maxStudents: number;
  createdAt: string;
  isAvailable: boolean;
  specialization?: { id: string; name: string } | null;
  academicYear?: { id: string; title: string } | null;
  professor?: PublicProfessor | null;
}

export interface PublicTopicDetail extends PublicTopic {
  requirements?: string[];
  objectives?: string[];
  // references?: { title: string; url: string }[]; // بعد migration
}
