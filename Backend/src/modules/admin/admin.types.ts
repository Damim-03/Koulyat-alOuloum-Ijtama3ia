// Admin module shared types. The request DTOs are inferred from the zod
// schemas in admin.validation.ts; re-export them here for convenience.
export type {
  ListQueryDTO,
  ListUsersDTO,
  CreateUserDTO,
  UpdateUserDTO,
  UpdateUserStatusDTO,
  ResetPasswordDTO,
  ListStudentsDTO,
  CreateStudentDTO,
  UpdateStudentDTO,
  CreateProfessorDTO,
  UpdateProfessorDTO,
  CreateFacultyDTO,
  UpdateFacultyDTO,
  CreateDepartmentDTO,
  UpdateDepartmentDTO,
  CreateSpecializationDTO,
  UpdateSpecializationDTO,
  CreateAcademicYearDTO,
  UpdateAcademicYearDTO,
  ListTopicsDTO,
  RejectTopicDTO,
  ChangeSupervisorDTO,
  AssignStudentDTO,
  CreateDefenseDTO,
  UpdateDefenseDTO,
} from "./admin.validation";

// Standard paginated list response shape returned by list services.
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}