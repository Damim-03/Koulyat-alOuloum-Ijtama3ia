import { Request, Response, NextFunction } from "express";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import { BadRequestException } from "../../core/utils/appErros";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  listUsersSchema,
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  resetPasswordSchema,
  listStudentsSchema,
  createStudentSchema,
  updateStudentSchema,
  createProfessorSchema,
  updateProfessorSchema,
  listQuerySchema,
  createFacultySchema,
  updateFacultySchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createFiliereSchema,
  updateFiliereSchema,
  createSpecializationSchema,
  updateSpecializationSchema,
  createAcademicYearSchema,
  updateAcademicYearSchema,
  listTopicsSchema,
  rejectTopicSchema,
  changeSupervisorSchema,
  assignStudentSchema,
  createDefenseSchema,
  updateDefenseSchema,
  listNotificationsSchema,
  listProfessorsSchema,
  createDomainSchema,
  listDomainsSchema,
  updateDomainSchema,
  ListDomainsDTO,
  ListFilieresDTO,
  listFilieresSchema,
  createAssignedTopicSchema,
  updateAssignedTopicSchema,
} from "./admin.validation";
import * as svc from "./admin.service";
import {
  listNotificationsService,
  unreadCountService,
  markNotificationReadService,
  markAllNotificationsReadService,
} from "../notification/notification.service";

// Small helper: validate body and throw a uniform error on failure.
function parseBody<T>(
  schema: { safeParse: (v: unknown) => any },
  body: unknown,
) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i: any) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join(" | ");
    throw new BadRequestException(
      `Validation error → ${issues}`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }
  return parsed.data as T;
}

//
// ─── STATS ────────────────────────────────────────────────────
//

export const getOverviewStatsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const stats = await svc.getOverviewStatsService();
    return res.status(HTTPSTATUS.OK).json({ stats });
  } catch (e) {
    next(e);
  }
};

export const getDashboardController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await svc.getDashboardService();
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

//
// ─── USERS ────────────────────────────────────────────────────
//

export const listUsersController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody(listUsersSchema, req.query);
    const data = await svc.listUsersService(q as never);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const getUserController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await svc.getUserByIdService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json({ user });
  } catch (e) {
    next(e);
  }
};

export const createUserController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createUserSchema, req.body);
    const user = await svc.createUserService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "User created", user });
  } catch (e) {
    next(e);
  }
};

export const updateUserController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateUserSchema, req.body);
    const user = await svc.updateUserService(
      req.params.id as string,
      data as never,
    );
    return res.status(HTTPSTATUS.OK).json({ message: "User updated", user });
  } catch (e) {
    next(e);
  }
};

export const updateUserStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateUserStatusSchema, req.body);
    const user = await svc.updateUserStatusService(
      req.params.id as string,
      data as never,
    );
    return res.status(HTTPSTATUS.OK).json({ message: "Status updated", user });
  } catch (e) {
    next(e);
  }
};

export const resetUserPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(resetPasswordSchema, req.body);
    const result = await svc.resetUserPasswordService(
      req.params.id as string,
      data as never,
    );
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

export const deleteUserController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteUserService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── STUDENTS ─────────────────────────────────────────────────
//

export const listStudentsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody(listStudentsSchema, req.query);
    const data = await svc.listStudentsService(q as never);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const getStudentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const student = await svc.getStudentByIdService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json({ student });
  } catch (e) {
    next(e);
  }
};

export const createStudentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createStudentSchema, req.body);
    const student = await svc.createStudentService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Student created", student });
  } catch (e) {
    next(e);
  }
};

export const updateStudentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateStudentSchema, req.body);
    const student = await svc.updateStudentService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Student updated", student });
  } catch (e) {
    next(e);
  }
};

export const deleteStudentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteStudentService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── PROFESSORS ───────────────────────────────────────────────
//

export const uploadImageController = (req: Request, res: Response) => {
  if (!req.file)
    throw new BadRequestException(
      "لم يُرفَع أي ملفّ",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  const url = `${req.protocol}://${req.get("host")}/uploads/cards/${req.file.filename}`;
  return res.status(HTTPSTATUS.OK).json({ url });
};

export const listProfessorsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody(listProfessorsSchema, req.query);
    const data = await svc.listProfessorsService(q as never);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const getProfessorController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const professor = await svc.getProfessorByIdService(
      req.params.id as string,
    );
    return res.status(HTTPSTATUS.OK).json({ professor });
  } catch (e) {
    next(e);
  }
};

export const createProfessorController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createProfessorSchema, req.body);
    const professor = await svc.createProfessorService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Professor created", professor });
  } catch (e) {
    next(e);
  }
};

export const updateProfessorController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateProfessorSchema, req.body);
    const professor = await svc.updateProfessorService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Professor updated", professor });
  } catch (e) {
    next(e);
  }
};

export const deleteProfessorController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteProfessorService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── FACULTIES ────────────────────────────────────────────────
//

export const listFacultiesController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const faculties = await svc.listFacultiesService();
    return res.status(HTTPSTATUS.OK).json({ faculties });
  } catch (e) {
    next(e);
  }
};

export const createFacultyController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createFacultySchema, req.body);
    const faculty = await svc.createFacultyService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Faculty created", faculty });
  } catch (e) {
    next(e);
  }
};

export const updateFacultyController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateFacultySchema, req.body);
    const faculty = await svc.updateFacultyService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Faculty updated", faculty });
  } catch (e) {
    next(e);
  }
};

export const deleteFacultyController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteFacultyService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── DOMAINS ──────────────────────────────────────────────────
//
export const listDomainsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody<ListDomainsDTO>(listDomainsSchema, req.query);
    const domains = await svc.listDomainsService(q.departmentId);
    return res.status(HTTPSTATUS.OK).json({ domains });
  } catch (e) {
    next(e);
  }
};

export const createDomainController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createDomainSchema, req.body);
    const domain = await svc.createDomainService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Domain created", domain });
  } catch (e) {
    next(e);
  }
};

export const updateDomainController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateDomainSchema, req.body);
    const domain = await svc.updateDomainService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Domain updated", domain });
  } catch (e) {
    next(e);
  }
};

export const deleteDomainController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteDomainService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── DEPARTMENTS ──────────────────────────────────────────────
//

export const listDepartmentsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const departments = await svc.listDepartmentsService();
    return res.status(HTTPSTATUS.OK).json({ departments });
  } catch (e) {
    next(e);
  }
};

export const createDepartmentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createDepartmentSchema, req.body);
    const department = await svc.createDepartmentService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Department created", department });
  } catch (e) {
    next(e);
  }
};

export const updateDepartmentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateDepartmentSchema, req.body);
    const department = await svc.updateDepartmentService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Department updated", department });
  } catch (e) {
    next(e);
  }
};

export const deleteDepartmentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteDepartmentService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── FILIERES ─────────────────────────────────────────────────
//

export const listFilieresController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody<ListFilieresDTO>(listFilieresSchema, req.query);
    const filieres = await svc.listFilieresService(q);
    return res.status(HTTPSTATUS.OK).json({ filieres });
  } catch (e) {
    next(e);
  }
};

export const createFiliereController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createFiliereSchema, req.body);
    const filiere = await svc.createFiliereService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Filiere created", filiere });
  } catch (e) {
    next(e);
  }
};

export const updateFiliereController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateFiliereSchema, req.body);
    const filiere = await svc.updateFiliereService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Filiere updated", filiere });
  } catch (e) {
    next(e);
  }
};

export const deleteFiliereController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteFiliereService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── SPECIALIZATIONS ──────────────────────────────────────────
//

export const listSpecializationsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const specializations = await svc.listSpecializationsService();
    return res.status(HTTPSTATUS.OK).json({ specializations });
  } catch (e) {
    next(e);
  }
};

export const createSpecializationController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createSpecializationSchema, req.body);
    const specialization = await svc.createSpecializationService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Specialization created", specialization });
  } catch (e) {
    next(e);
  }
};

export const updateSpecializationController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateSpecializationSchema, req.body);
    const specialization = await svc.updateSpecializationService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Specialization updated", specialization });
  } catch (e) {
    next(e);
  }
};

export const deleteSpecializationController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteSpecializationService(
      req.params.id as string,
    );
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── ACADEMIC YEARS ───────────────────────────────────────────
//

export const listAcademicYearsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const academicYears = await svc.listAcademicYearsService();
    return res.status(HTTPSTATUS.OK).json({ academicYears });
  } catch (e) {
    next(e);
  }
};

export const createAcademicYearController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createAcademicYearSchema, req.body);
    const academicYear = await svc.createAcademicYearService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Academic year created", academicYear });
  } catch (e) {
    next(e);
  }
};

export const updateAcademicYearController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateAcademicYearSchema, req.body);
    const academicYear = await svc.updateAcademicYearService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Academic year updated", academicYear });
  } catch (e) {
    next(e);
  }
};

export const activateAcademicYearController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const academicYear = await svc.activateAcademicYearService(
      req.params.id as string,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Academic year activated", academicYear });
  } catch (e) {
    next(e);
  }
};

export const deleteAcademicYearController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteAcademicYearService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};

//
// ─── TOPICS ───────────────────────────────────────────────────
//

export const listTopicsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody(listTopicsSchema, req.query);
    const data = await svc.listTopicsService(q as never);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const getTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topic = await svc.getTopicByIdService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json({ topic });
  } catch (e) {
    next(e);
  }
};

export const approveTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topic = await svc.approveTopicService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json({ message: "Topic approved", topic });
  } catch (e) {
    next(e);
  }
};

export const rejectTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(rejectTopicSchema, req.body ?? {});
    const topic = await svc.rejectTopicService(
      req.params.id as string,
      data as never,
    );
    return res.status(HTTPSTATUS.OK).json({ message: "Topic rejected", topic });
  } catch (e) {
    next(e);
  }
};

export const archiveTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topic = await svc.archiveTopicService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json({ message: "Topic archived", topic });
  } catch (e) {
    next(e);
  }
};

export const publishTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topic = await svc.publishTopicService(req.params.id as string);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Topic published", topic });
  } catch (e) {
    next(e);
  }
};

export const unpublishTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topic = await svc.unpublishTopicService(req.params.id as string);
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Topic unpublished", topic });
  } catch (e) {
    next(e);
  }
};

//
// ─── APPLICATIONS ─────────────────────────────────────────────
//

export const listApplicationsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody(listQuerySchema, req.query);
    const data = await svc.listApplicationsService(q as never);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const acceptApplicationController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const application = await svc.acceptApplicationService(
      req.params.id as string,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Application accepted", application });
  } catch (e) {
    next(e);
  }
};

export const rejectApplicationController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const application = await svc.rejectApplicationService(
      req.params.id as string,
      (req.body?.reason as string) ?? undefined,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Application rejected", application });
  } catch (e) {
    next(e);
  }
};

//
// ─── PROJECTS ─────────────────────────────────────────────────
//

export const listProjectsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody(listQuerySchema, req.query);
    const data = await svc.listProjectsService(q as never);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const getProjectController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const project = await svc.getProjectByIdService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json({ project });
  } catch (e) {
    next(e);
  }
};

export const changeSupervisorController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(changeSupervisorSchema, req.body);
    const project = await svc.changeSupervisorService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Supervisor changed", project });
  } catch (e) {
    next(e);
  }
};

export const assignStudentController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(assignStudentSchema, req.body);
    const project = await svc.assignStudentService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Student assigned", project });
  } catch (e) {
    next(e);
  }
};

export const listGroupMilestonesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const milestones = await svc.listGroupMilestonesService(
      req.params.groupId as string,
    );
    return res.status(HTTPSTATUS.OK).json({ milestones });
  } catch (e) {
    next(e);
  }
};

//
// ─── DEFENSES ─────────────────────────────────────────────────
//

export const listDefensesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody(listQuerySchema, req.query);
    const data = await svc.listDefensesService(q as never);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const createDefenseController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createDefenseSchema, req.body);
    const defense = await svc.createDefenseService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Defense scheduled", defense });
  } catch (e) {
    next(e);
  }
};

export const updateDefenseController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateDefenseSchema, req.body);
    const defense = await svc.updateDefenseService(
      req.params.id as string,
      data as never,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Defense updated", defense });
  } catch (e) {
    next(e);
  }
};

export const deleteDefenseController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await svc.deleteDefenseService(req.params.id as string);
    return res.status(HTTPSTATUS.OK).json(result);
  } catch (e) {
    next(e);
  }
};
//
// ─── GROUP REQUESTS ───────────────────────────────────────────
//

export const listGroupRequestsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = parseBody(listQuerySchema, req.query);
    const data = await svc.listGroupRequestsService(q as never);
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const getGroupRequestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const groupRequest = await svc.getGroupRequestService(
      req.params.id as string,
    );
    return res.status(HTTPSTATUS.OK).json({ groupRequest });
  } catch (e) {
    next(e);
  }
};

export const acceptGroupRequestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const groupRequest = await svc.acceptGroupRequestService(
      req.params.id as string,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Group request accepted", groupRequest });
  } catch (e) {
    next(e);
  }
};

export const rejectGroupRequestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const groupRequest = await svc.rejectGroupRequestService(
      req.params.id as string,
      (req.body?.reason as string) ?? undefined,
    );
    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Group request rejected", groupRequest });
  } catch (e) {
    next(e);
  }
};

//
// ─── NOTIFICATIONS (admin's own bell) ─────────────────────────
//

// عدِّل هذا إن كان وسيط المصادقة يخزّن المستخدم بمفتاح مختلف
// (مثل req.userId أو req.user.userId).
const getAuthUserId = (req: Request): string => {
  const id =
    (req as any).user?.id ?? (req as any).user?.userId ?? (req as any).userId;
  if (!id)
    throw new BadRequestException(
      "Authenticated user not found",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  return id as string;
};

export const listMyNotificationsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = listNotificationsSchema.parse(req.query);
    const data = await listNotificationsService(getAuthUserId(req), {
      page: q.page,
      limit: q.limit,
      onlyUnread: q.unread,
    });
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const unreadNotificationsCountController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await unreadCountService(getAuthUserId(req));
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const markNotificationReadController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await markNotificationReadService(
      getAuthUserId(req),
      req.params.id as string,
    );
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const markAllNotificationsReadController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await markAllNotificationsReadService(getAuthUserId(req));
    return res.status(HTTPSTATUS.OK).json(data);
  } catch (e) {
    next(e);
  }
};

export const createAssignedTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(createAssignedTopicSchema, req.body);
    const topic = await svc.createAssignedTopicService(data as never);
    return res
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Topic created and assigned", topic });
  } catch (e) {
    next(e);
  }
};

export const updateAssignedTopicController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = parseBody(updateAssignedTopicSchema, req.body);
    const topic = await svc.updateAssignedTopicService(
      req.params.id as string,
      data as never,
    );
    return res.status(HTTPSTATUS.OK).json({ message: "Topic updated", topic });
  } catch (e) {
    next(e);
  }
};
