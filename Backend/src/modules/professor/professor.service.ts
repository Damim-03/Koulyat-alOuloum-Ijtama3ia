import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  UnauthorizedException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { CreateTopicDTO, UpdateTopicDTO } from "./professor.validation";

//
// ─── GET PROFESSOR BY USERID ─────────────────────────────────
//

const getProfessor = async (userId: string) => {
  const professor = await prisma.professor.findUnique({
    where: { userId },
  });

  if (!professor) {
    throw new NotFoundException(
      "Professor not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  return professor;
};

//
// ─── CREATE TOPIC ─────────────────────────────────────────────
//

export const createTopicService = async (
  userId: string,
  data: CreateTopicDTO,
) => {
  const professor = await getProfessor(userId);

  const topic = await prisma.graduationTopic.create({
    data: {
      title: data.title,
      description: data.description,
      maxStudents: data.maxStudents,
      specializationId: data.specializationId,
      academicYearId: data.academicYearId,
      professorId: professor.id,
      status: "pending",
    },
    include: {
      specialization: true,
      academicYear: true,
    },
  });

  return topic;
};

//
// ─── GET MY TOPICS ────────────────────────────────────────────
//

export const getMyTopicsService = async (userId: string) => {
  const professor = await getProfessor(userId);

  const topics = await prisma.graduationTopic.findMany({
    where: { professorId: professor.id },
    include: {
      specialization: true,
      academicYear: true,
      _count: {
        select: { applications: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return topics;
};

//
// ─── GET TOPIC BY ID ──────────────────────────────────────────
//

export const getTopicByIdService = async (userId: string, topicId: string) => {
  const professor = await getProfessor(userId);

  const topic = await prisma.graduationTopic.findUnique({
    where: { id: topicId },
    include: {
      specialization: true,
      academicYear: true,
      applications: {
        include: {
          student: {
            include: { user: true },
          },
        },
      },
    },
  });

  if (!topic) {
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (topic.professorId !== professor.id) {
    throw new UnauthorizedException(
      "You do not own this topic",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  return topic;
};

//
// ─── UPDATE TOPIC ─────────────────────────────────────────────
//

export const updateTopicService = async (
  userId: string,
  topicId: string,
  data: UpdateTopicDTO,
) => {
  const professor = await getProfessor(userId);

  const topic = await prisma.graduationTopic.findUnique({
    where: { id: topicId },
  });

  if (!topic) {
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (topic.professorId !== professor.id) {
    throw new UnauthorizedException(
      "You do not own this topic",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  // Can only edit if pending or rejected
  if (topic.status !== "pending" && topic.status !== "rejected") {
    throw new UnauthorizedException(
      "Cannot edit a topic that is already approved or open",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  const updated = await prisma.graduationTopic.update({
    where: { id: topicId },
    data,
  });

  return updated;
};

//
// ─── DELETE TOPIC ─────────────────────────────────────────────
//

export const deleteTopicService = async (userId: string, topicId: string) => {
  const professor = await getProfessor(userId);

  const topic = await prisma.graduationTopic.findUnique({
    where: { id: topicId },
  });

  if (!topic) {
    throw new NotFoundException(
      "Topic not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (topic.professorId !== professor.id) {
    throw new UnauthorizedException(
      "You do not own this topic",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  // Can only delete if pending or rejected
  if (topic.status !== "pending" && topic.status !== "rejected") {
    throw new UnauthorizedException(
      "Cannot delete a topic that is already approved or open",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  await prisma.graduationTopic.delete({
    where: { id: topicId },
  });

  return { message: "Topic deleted successfully" };
};
