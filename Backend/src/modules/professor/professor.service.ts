import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  CreateTopicDTO,
  UpdateTopicDTO,
  CreateMilestoneDTO,
  UpdateMilestoneDTO,
} from "./professor.validation";
import { publicUser } from "../../core/prisma/selects";

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
      requirements: data.requirements ?? [],
      objectives: data.objectives ?? [],
      references: data.references ?? [],
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
        select: { groupRequests: true },
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

//
// ═══════════════════════════════════════════════════════════════
//  APPLICATIONS
// ═══════════════════════════════════════════════════════════════
//

// ─── LIST APPLICATIONS (for this professor's topics) ──────────


// ─── helper: load an application owned by this professor ──────


// ─── ACCEPT APPLICATION ───────────────────────────────────────


// ─── REJECT APPLICATION ───────────────────────────────────────


//
// ═══════════════════════════════════════════════════════════════
//  MILESTONES
// ═══════════════════════════════════════════════════════════════
//

// ─── helper: load a project group owned by this professor ─────

const getOwnedGroup = async (professorId: string, groupId: string) => {
  const group = await prisma.projectGroup.findUnique({
    where: { id: groupId },
    include: { topic: true },
  });

  if (!group) {
    throw new NotFoundException(
      "Project group not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (group.topic.professorId !== professorId) {
    throw new UnauthorizedException(
      "You do not own this project group",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  return group;
};

// ─── CREATE MILESTONE ─────────────────────────────────────────

export const createMilestoneService = async (
  userId: string,
  groupId: string,
  data: CreateMilestoneDTO,
) => {
  const professor = await getProfessor(userId);
  await getOwnedGroup(professor.id, groupId);

  return prisma.milestone.create({
    data: {
      title: data.title,
      description: data.description,
      deadline: data.deadline,
      order: data.order,
      groupId,
      status: "pending",
    },
  });
};

// ─── LIST MILESTONES ──────────────────────────────────────────

export const getMilestonesService = async (userId: string, groupId: string) => {
  const professor = await getProfessor(userId);
  await getOwnedGroup(professor.id, groupId);

  return prisma.milestone.findMany({
    where: { groupId },
    orderBy: { order: "asc" },
    include: { submissions: true },
  });
};

// ─── helper: load a milestone owned by this professor ─────────

const getOwnedMilestone = async (professorId: string, milestoneId: string) => {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { group: { include: { topic: true } } },
  });

  if (!milestone) {
    throw new NotFoundException(
      "Milestone not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (milestone.group.topic.professorId !== professorId) {
    throw new UnauthorizedException(
      "You do not own this milestone",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED,
    );
  }

  return milestone;
};

// ─── UPDATE MILESTONE (fields + status) ───────────────────────

export const updateMilestoneService = async (
  userId: string,
  milestoneId: string,
  data: UpdateMilestoneDTO,
) => {
  const professor = await getProfessor(userId);
  await getOwnedMilestone(professor.id, milestoneId);

  return prisma.milestone.update({ where: { id: milestoneId }, data });
};

// ─── DELETE MILESTONE ─────────────────────────────────────────

export const deleteMilestoneService = async (
  userId: string,
  milestoneId: string,
) => {
  const professor = await getProfessor(userId);
  await getOwnedMilestone(professor.id, milestoneId);

  await prisma.milestone.delete({ where: { id: milestoneId } });

  return { message: "Milestone deleted successfully" };
};

//
// ═══════════════════════════════════════════════════════════════
//  PROJECT GROUPS (supervised projects)
// ═══════════════════════════════════════════════════════════════
//

// ─── LIST MY GROUPS ───────────────────────────────────────────

export const getMyGroupsService = async (userId: string) => {
  const professor = await getProfessor(userId);

  return prisma.projectGroup.findMany({
    where: { topic: { professorId: professor.id } },
    include: {
      topic: {
        select: { id: true, title: true, status: true, maxStudents: true },
      },
      members: {
        include: { student: { include: { user: publicUser } } },
      },
      _count: { select: { milestones: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ─── GET GROUP BY ID (full detail) ────────────────────────────

export const getGroupByIdService = async (userId: string, groupId: string) => {
  const professor = await getProfessor(userId);
  await getOwnedGroup(professor.id, groupId); // ownership check

  return prisma.projectGroup.findUnique({
    where: { id: groupId },
    include: {
      topic: {
        select: { id: true, title: true, status: true, maxStudents: true },
      },
      members: {
        include: { student: { include: { user: publicUser } } },
      },
      milestones: {
        orderBy: { order: "asc" },
        include: {
          submissions: {
            include: {
              uploadedBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
      defense: true,
    },
  });
};
