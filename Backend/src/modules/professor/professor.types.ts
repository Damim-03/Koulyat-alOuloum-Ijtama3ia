import { TopicStatus } from "../../generated/prisma";

export interface CreateTopicInput {
  title: string;
  description: string;
  maxStudents: number;
  specializationId: string;
  academicYearId: string;
  requirements?: string[];
  objectives?: string[];
}

export interface UpdateTopicInput {
  title?: string;
  description?: string;
  maxStudents?: number;
  requirements?: string[];
  objectives?: string[];
}