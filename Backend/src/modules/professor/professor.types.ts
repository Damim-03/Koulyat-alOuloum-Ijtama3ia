import { TopicStatus } from "../../generated/prisma";

export interface CreateTopicInput {
  title: string;
  description: string;
  maxStudents: number;
  specializationId: string;
  academicYearId: string;
}

export interface UpdateTopicInput {
  title?: string;
  description?: string;
  maxStudents?: number;
}