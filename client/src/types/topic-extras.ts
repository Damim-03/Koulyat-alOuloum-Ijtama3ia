/**
 * What a topic carries beside its title (Backend core/topic/topic-extras): a
 * co-supervisor from the platform, a short description, and a type set by the
 * administration for the department — its code numbers the official list's
 * rows (AI01…) and its colour marks them.
 */

/** A type as a topic form offers it. */
export interface TopicTypeOption {
  id: string;
  name: string;
  code: string;
  /** «#dbeafe» — a light tint, printed behind dark text. */
  color: string;
  departmentId: string;
}

/** A type as the administration manages it. */
export interface TopicTypeRow extends TopicTypeOption {
  sortOrder: number;
  department: { id: string; name: string };
  topicsCount: number;
}

/** A professor to pick a co-supervisor from. */
export interface ProfessorOption {
  id: string;
  firstName: string | null;
  lastName: string | null;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  department: { id: string; name: string };
  /** The professor reading the list — not their own co-supervisor. */
  isMe?: boolean;
}

export interface TopicTypeBadge {
  id: string;
  name: string;
  code: string;
  color: string;
}

export interface TopicCoSupervisor {
  id: string;
  user: { firstName: string | null; lastName: string | null; firstNameLatin: string | null; lastNameLatin: string | null };
}

/** The three as a topic's reader receives them. */
export interface TopicExtrasRead {
  summary?: string | null;
  coSupervisorId?: string | null;
  typeId?: string | null;
  coSupervisor?: TopicCoSupervisor | null;
  type?: TopicTypeBadge | null;
}
