/**
 * The columns of the topics' Excel file the administrator may leave out —
 * «#» and the title are always there (topic-export.service).
 */
export const TOPIC_EXPORT_COLUMNS = [
  "supervisor",
  "coSupervisor",
  "summary",
  "type",
  "capacity",
  "status",
  "faculty",
  "department",
  "filiere",
  "level",
  "specialization",
  "year",
] as const;
export type TopicExportColumn = (typeof TOPIC_EXPORT_COLUMNS)[number];
