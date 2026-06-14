import { Request, Response, NextFunction } from "express";
import { HTTPSTATUS } from "../../core/config/http/http.config";
import {
  listFacultiesService,
  listDepartmentsService,
  listSpecializationsService,
  listAcademicYearsService,
} from "./common.service";

export const listFacultiesController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const faculties = await listFacultiesService();
    return res.status(HTTPSTATUS.OK).json({ faculties });
  } catch (error) {
    next(error);
  }
};

export const listDepartmentsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const facultyId = req.query.facultyId as string | undefined;
    const departments = await listDepartmentsService(facultyId);
    return res.status(HTTPSTATUS.OK).json({ departments });
  } catch (error) {
    next(error);
  }
};

export const listSpecializationsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const specializations = await listSpecializationsService(departmentId);
    return res.status(HTTPSTATUS.OK).json({ specializations });
  } catch (error) {
    next(error);
  }
};

export const listAcademicYearsController = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const academicYears = await listAcademicYearsService();
    return res.status(HTTPSTATUS.OK).json({ academicYears });
  } catch (error) {
    next(error);
  }
};