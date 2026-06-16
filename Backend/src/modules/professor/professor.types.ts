import { TopicStatus } from "../../generated/prisma";

export interface TopicReference {
  title: string;
  url: string;
}

export interface CreateTopicInput {
  title: string;
  description: string;
  maxStudents: number;
  specializationId: string;
  academicYearId: string;
  requirements?: string[];
  objectives?: string[];
  references?: TopicReference[];
}

export interface UpdateTopicInput {
  title?: string;
  description?: string;
  maxStudents?: number;
  requirements?: string[];
  objectives?: string[];
  references?: TopicReference[];
}
