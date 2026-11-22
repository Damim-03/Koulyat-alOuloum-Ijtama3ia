import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { filterByAction } from "../../lib/topic-actions";
import { useTranslation } from "react-i18next";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import {
  Search,
  Check,
  X,
  Archive,
  Send,
  EyeOff,
  Plus,
  FilePlus2,
  Pencil,
  Trash2,
  Undo2,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  FilterX,
  ScanLine,
  ListOrdered,
  FileSpreadsheet,
  FileUp,
  FileDown,
  Tags,
  Settings2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../../api/admin.api";
import { statusChip } from "../../utils/status-styles";
import {
  useAdminTopics,
  useProfessors,
  useSpecializations,
  useFaculties,
  useAcademicYears,
} from "../../hooks/admin-hook";
import { TopicDialog } from "../../components/dialog/projects/topic-dialog.form";
import { AssignedTopicDialog } from "../../components/dialog/projects/assigned-topic-dialog.form";
import { EditAssignedTopicDialog } from "../../components/dialog/projects/edit-assigned-topic-dialog.form";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import { None } from "../../../../lib/none";
import { Select } from "../../../../components/ui/select";
import {
  BulkTopicsDialog,
  type BulkTopicMode,
} from "../../components/dialog/topic/bulk-topics-dialog";
import { SupervisionDialog } from "../../../supervision/components/supervision-dialog";
import { ScanDialog } from "../../../supervision/components/scan-dialog";
import { ActionMenu } from "../../../../components/ui/action-menu";
import { TopicTitlesDialog } from "../../components/dialog/topic/topic-titles-dialog";
import { TopicTypesDialog } from "../../components/dialog/topic/topic-types-dialog";
import { TopicExportDialog } from "../../components/dialog/topic/topic-export-dialog";
import { TopicSettingsStrip } from "../../components/dialog/topic/topic-settings-strip";
import { TopicImportDialog } from "../../components/dialog/topic/topic-import-dialog";
import { AssignedTopicImportDialog } from "../../components/dialog/topic/assigned-topic-import-dialog";
import { personName } from "../../../../lib/person-name";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { stackOnPhone } from "../../../../lib/stack-table";
import { isPhoneNow } from "../../../../hooks/use-media-query";
import { SPEC_LEVELS, SPEC_LEVEL_KEY, type SpecLevel } from "../../components/dialog/user/user-form-steps";

/* eslint-disable @typescript-eslint/no-explicit-any */


const STATUS_FILTERS = [
  "",
  "pending",
  "approved",
  "open",
  "full",
  "rejected",
  "archived",
] as const;

const PAGE_SIZE = 10;

export function AdminTopicsPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const openTopic = (id: string) => navigate(`/admin/topics/${id}`);

  // filters
  const [search, setSearch] = useState("");
  // A link may arrive with its filter — the dashboard's "pending proposals".
  const [initial] = useSearchParams();
  const [status, setStatus] = useState(() => {
    const s = initial.get("status") ?? "";
    return (STATUS_FILTERS as readonly string[]).includes(s) ? s : "";
  });
  const [professorId, setProfessorId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  // Open from a tablet up; on a phone the filters alone would fill the screen.
  const [filtersOpen, setFiltersOpen] = useState(() => !isPhoneNow());
  const [specializationId, setSpecializationId] = useState("");
  // Licence, master and doctorate never mix: the level narrows everything the page shows and gives.
  const [level, setLevel] = useState<SpecLevel | "">("");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  /** نافذة الإجراء على المحدَّد — حذفٌ أو رفض — أو لا نافذة. */
  const [bulkDialog, setBulkDialog] = useState<BulkTopicMode | null>(null);
  /** الموضوع الذي تُعرض ورقةُ الموافقة على إشرافه. */
  const [scanOpen, setScanOpen] = useState(false);
  const [titlesOpen, setTitlesOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [assignedImportOpen, setAssignedImportOpen] = useState(false);
  const [supervisionTopicId, setSupervisionTopicId] = useState<string | null>(
    null,
  );

  function clearFilters() {
    setSearch("");
    setStatus("");
    setProfessorId("");
    setAcademicYearId("");
    setFacultyId("");
    setDepartmentId("");
    setFiliereId("");
    setSpecializationId("");
    setLevel("");
  }

  const activeFilters =
    (search ? 1 : 0) +
    (professorId ? 1 : 0) +
    (status ? 1 : 0) +
    (facultyId ? 1 : 0) +
    (departmentId ? 1 : 0) +
    (filiereId ? 1 : 0) +
    (specializationId ? 1 : 0) +
    (level ? 1 : 0) +
    (academicYearId ? 1 : 0);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // reset page + selection whenever a filter changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [
    debouncedSearch,
    status,
    professorId,
    academicYearId,
    facultyId,
    departmentId,
    filiereId,
    specializationId,
    level,
  ]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: status || undefined,
      professorId: professorId || undefined,
      academicYearId: academicYearId || undefined,
      facultyId: facultyId || undefined,
      departmentId: departmentId || undefined,
      filiereId: filiereId || undefined,
      specializationId: specializationId || undefined,
      level: level || undefined,
    }),
    [
      page,
      debouncedSearch,
      status,
      professorId,
      academicYearId,
      facultyId,
      departmentId,
      filiereId,
      specializationId,
      level,
    ],
  );

  const qc = useQueryClient();
  const { data, isLoading, isError, isFetching, refetch } =
    useAdminTopics(params);
  // 100 is the API's ceiling for `limit` (listQuerySchema). Asking for more
  // is rejected outright, which empties the filter instead of widening it.
  const { data: profsData } = useProfessors({ limit: 100 });
  const { data: specs } = useSpecializations();
  const { data: faculties } = useFaculties();
  const { data: years } = useAcademicYears();
  /** The year the settings are read for: the filter's, else the current one. */
  const yearInView = academicYearId || years?.find((y) => y.isActive && !y.archivedAt)?.id;

  const topics = (data?.items ?? []) as any[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const professors = profsData?.items ?? [];

  // ── Cascading options derived from specializations (each carries filiere.department) ──
  const facultyById = useMemo(
    () => new Map((faculties ?? []).map((f: any) => [f.id, f])),
    [faculties],
  );
  // `specs ?? []` built a fresh array on every render while the query was
  // still loading, invalidating all four option memos below each time.
  const specList = useMemo(() => (specs ?? []) as any[], [specs]);

  const facultyOptions = useMemo(() => {
    const seen = new Map<string, any>();
    for (const s of specList) {
      const fid = s.filiere?.department?.facultyId;
      const fac = fid ? facultyById.get(fid) : undefined;
      if (fac && !seen.has(fac.id)) seen.set(fac.id, fac);
    }
    return [...seen.values()];
  }, [specList, facultyById]);

  const deptOptions = useMemo(() => {
    const seen = new Map<string, any>();
    for (const s of specList) {
      const d = s.filiere?.department;
      if (!d) continue;
      if (facultyId && d.facultyId !== facultyId) continue;
      if (!seen.has(d.id)) seen.set(d.id, d);
    }
    return [...seen.values()];
  }, [specList, facultyId]);

  const filiereOptions = useMemo(() => {
    const seen = new Map<string, any>();
    for (const s of specList) {
      const f = s.filiere;
      if (!f) continue;
      if (facultyId && f.department?.facultyId !== facultyId) continue;
      if (departmentId && f.departmentId !== departmentId) continue;
      if (!seen.has(f.id)) seen.set(f.id, f);
    }
    return [...seen.values()];
  }, [specList, facultyId, departmentId]);

  const specOptions = useMemo(() => {
    return specList.filter((s) => {
      if (level && s.level !== level) return false;
      if (filiereId) return s.filiereId === filiereId;
      if (departmentId) return s.filiere?.departmentId === departmentId;
      if (facultyId) return s.filiere?.department?.facultyId === facultyId;
      return true;
    });
  }, [specList, facultyId, departmentId, filiereId, level]);

  // ── Multi-select ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
  }, [params]);

  const pageIds = topics.map((tp) => tp.id);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const selectedTopics = topics.filter((tp) => selected.has(tp.id));

  /*
   * Every one of these used to be a status test written here — a second copy
   * of the server's rules, kept in step by hand. They drifted, as copies do:
   * `deletable` asked `status !== "full"` while the server asked whether a
   * project group existed, so an archived topic that had completed offered a
   * delete that could never succeed.
   *
   * The server now sends its own verdict with every topic. These read it.
   */
  const approvable = filterByAction(selectedTopics, "approve");
  const publishable = filterByAction(selectedTopics, "publish");
  const unpublishable = filterByAction(selectedTopics, "unpublish");
  const rejectable = filterByAction(selectedTopics, "reject");
  const archivable = filterByAction(selectedTopics, "archive");
  const unarchivable = filterByAction(selectedTopics, "unarchive");
  const deletable = filterByAction(selectedTopics, "delete");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  /**
   * Runs one action over a set of topics.
   *
   * Every item is attempted even when some fail — the server guards a few
   * transitions (a topic with a formed group cannot be deleted), and one such
   * refusal must not abandon the rest of the selection. The outcome is
   * reported once at the end: the per-item mutation hooks were each firing
   * their own toast and cache invalidation, so a run over ten rows produced
   * ten toasts and ten refetches while the loop was still going.
   */
  async function runBulk(items: any[], fn: (id: string) => Promise<unknown>) {
    if (items.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: items.length });

    let ok = 0;
    let failed = 0;
    try {
      for (const tp of items) {
        try {
          await fn(tp.id);
          ok++;
        } catch {
          failed++;
        }
        setBulkProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    } finally {
      await qc.invalidateQueries({ queryKey: ["admin", "topics"] });
      setSelected(new Set());
      setBulkBusy(false);
      setBulkProgress({ done: 0, total: 0 });
    }

    if (failed === 0) toast.success(t("admin.bulkDone", { n: ok }));
    else if (ok === 0) toast.error(t("admin.bulkAllFailed", { n: failed }));
    else toast.warning(t("admin.bulkPartial", { ok, failed }));
  }

  async function bulkDelete() {
    await runBulk(deletable, adminApi.deleteTopic);
    setBulkDialog(null);
  }

  async function bulkReject(reason?: string) {
    await runBulk(rejectable, (id) => adminApi.rejectTopic(id, reason));
    setBulkDialog(null);
  }

  const bulkApprove = () => runBulk(approvable, adminApi.approveTopic);
  const bulkPublish = () => runBulk(publishable, adminApi.publishTopic);
  const bulkUnpublish = () => runBulk(unpublishable, adminApi.unpublishTopic);
  const bulkArchive = () => runBulk(archivable, adminApi.archiveTopic);
  const bulkUnarchive = () => runBulk(unarchivable, adminApi.unarchiveTopic);

  function profName(tp: any) {
    const u = tp.professor?.user;
    return (
      personName(u) ||
      tp.professor?.universityEmail ||
      "\u2014"
    );
  }

  return (
    <div className="font-body">
      {/*
        Header: the title on the right, the tools on the left, as on every
        page. Where they go is decided by the screen's width alone, never by
        the room left beside the sidebar: wrapping by that room moved every
        button under the title when the sidebar opened, and back when it
        folded. From 1780px — room for them even beside the open sidebar,
        the description taking two lines — they share the title's row;
        below it, they sit under it, still on the left.
      */}
      <div className="mb-6 flex flex-col items-end gap-4 min-[1780px]:flex-row min-[1780px]:items-center min-[1780px]:justify-between">
        <div className="min-w-0 self-stretch min-[1780px]:flex-1 min-[1780px]:self-auto">
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("admin.topicsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">{t("admin.topicsSubtitle")}</p>
        </div>

        {/*
          Three groups, by what they are for: tools that read or print what is
          already there, bringing topics in from Excel, and creating one — the
          last, and most used, in gold.
        */}
        <div className="flex flex-wrap items-center justify-end gap-2 min-[1780px]:shrink-0 min-[1780px]:flex-nowrap">
          <div
            role="group"
            aria-label={t("admin.topicTools")}
            className="inline-flex items-stretch overflow-hidden rounded-xl border border-forest/15 bg-cream-card/60"
          >
            {/* The year's periods and team sizes: their own page, the year of the filter carried there. */}
            <button
              type="button"
              onClick={() => navigate(`/admin/topics/settings${yearInView ? `?year=${encodeURIComponent(yearInView)}` : ""}`)}
              title={t("admin.topicSettings.subtitle")}
              data-testid="open-topic-settings"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-forest/80 transition hover:bg-gold/10 hover:text-forest"
            >
              <Settings2 size={17} />
              {t("admin.topicSettings.button")}
            </button>
            {/* The list the department prints: before assignment or after. */}
            <button
              type="button"
              onClick={() => setTitlesOpen(true)}
              title={t("admin.titlesList.subtitle")}
              data-testid="open-titles-list"
              className="inline-flex items-center gap-2 border-s border-forest/10 px-3.5 py-2.5 text-[13px] font-medium text-forest/80 transition hover:bg-gold/10 hover:text-forest"
            >
              <ListOrdered size={17} />
              {t("admin.titlesList.button")}
            </button>
            {/* The department's topic types: their codes number the list above, their colours mark it. */}
            <button
              type="button"
              onClick={() => setTypesOpen(true)}
              title={t("topicTypes.subtitle")}
              data-testid="open-topic-types"
              className="inline-flex items-center gap-2 border-s border-forest/10 px-3.5 py-2.5 text-[13px] font-medium text-forest/80 transition hover:bg-gold/10 hover:text-forest"
            >
              <Tags size={17} />
              {t("topicTypes.button")}
            </button>
            {/*
              مسحُ ورقةٍ في اليد للوصول إلى مشروعها — الطريقُ المعاكس للقائمة:
              من الورق إلى الشاشة لا من الشاشة إلى الورق.
            */}
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              title={t("supervision.scanSubtitle")}
              className="inline-flex items-center gap-2 border-s border-forest/10 px-3.5 py-2.5 text-[13px] font-medium text-forest/80 transition hover:bg-sage/10 hover:text-forest"
            >
              <ScanLine size={17} />
              {t("supervision.scan")}
            </button>
            {/* The table as a file: the same filters, with its students or without. */}
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              title={t("admin.topicExport.subtitle")}
              data-testid="open-topic-export"
              className="inline-flex items-center gap-2 border-s border-forest/10 px-3.5 py-2.5 text-[13px] font-medium text-forest/80 transition hover:bg-gold/10 hover:text-forest"
            >
              <FileDown size={17} />
              {t("admin.topicExport.button")}
            </button>
          </div>

          <span aria-hidden className="mx-1 hidden h-7 w-px bg-forest/12 sm:block" />

          <ActionMenu
            label={t("admin.importMenu.button")}
            icon={FileSpreadsheet}
            testId="open-import-menu"
            items={[
              {
                // مقترحات الأساتذة دفعةً واحدة، من ملفّ Excel.
                key: "proposals",
                label: t("admin.importMenu.proposals"),
                hint: t("admin.importTopic.subtitle"),
                icon: FileSpreadsheet,
                onSelect: () => setImportOpen(true),
                testId: "open-topic-import",
              },
              {
                // المواضيع المُسنَدة بطلبتها من Excel — نموذجٌ مستقلّ عن الأوّل.
                key: "assigned",
                label: t("admin.importMenu.assigned"),
                hint: t("admin.importAssigned.subtitle"),
                icon: FileUp,
                onSelect: () => setAssignedImportOpen(true),
                testId: "open-assigned-topic-import",
              },
            ]}
          />

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            title={t("admin.createTopicSubtitle")}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:border-gold hover:bg-gold/10"
          >
            <FilePlus2 size={18} />
            {t("admin.createTopicBtn")}
          </button>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            title={t("admin.assignTopicSubtitle")}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep shadow-sm transition hover:bg-gold-soft"
          >
            <Plus size={18} />
            {t("admin.assignTopicBtn")}
          </button>
        </div>
      </div>

      {/*
        The year's settings in one line — the proposal period, the selection
        deadline, the team size — for the year in view: the page's year, else
        the current one. In full, and edited, on their own page. Once the
        years are in — before, "no current year" would flash while they load.
      */}
      {years && <TopicSettingsStrip yearId={yearInView} />}

      {/* Filters */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        {/* Header */}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-forest/5"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-forest" />

            <span className="font-semibold text-forest">{t("admin.filters")}</span>

            {activeFilters > 0 && (
              <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">
                {activeFilters}
              </span>
            )}
          </div>

          {filtersOpen ? (
            <ChevronUp size={20} className="text-clay" />
          ) : (
            <ChevronDown size={20} className="text-clay" />
          )}
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            filtersOpen
              ? "max-h-[900px] border-t border-forest/10 p-4"
              : "max-h-0"
          }`}
        >
          {/* Search + Professor + Status */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
                size={18}
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin.searchTopic")}
                className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </div>

            <Select
              value={professorId}
              onChange={setProfessorId}
              aria-label={t("admin.allProfessors")}
              options={[
                { value: "", label: t("admin.allProfessors") },
                ...professors.map((p: any) => ({
                  value: p.id,
                  label:
                    personName(p.user) || p.universityEmail,
                })),
              ]}
            />

            <Select
              value={status}
              onChange={setStatus}
              aria-label={t("admin.statusAll")}
              options={STATUS_FILTERS.map((st) => ({
                value: st,
                label: st ? t(`status.${st}`) : t("admin.statusAll"),
              }))}
            />
          </div>

          {/* Academic Filters */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Select
              value={facultyId}
              onChange={(v) => {
                setFacultyId(v);
                setDepartmentId("");
                setFiliereId("");
                setSpecializationId("");
              }}
              aria-label={t("admin.allFaculties")}
              options={[
                { value: "", label: t("admin.allFaculties") },
                ...facultyOptions.map((f) => ({ value: f.id, label: f.name })),
              ]}
            />

            <Select
              value={departmentId}
              onChange={(v) => {
                setDepartmentId(v);
                setFiliereId("");
                setSpecializationId("");
              }}
              aria-label={t("admin.allDepartments")}
              options={[
                { value: "", label: t("admin.allDepartments") },
                ...deptOptions.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />

            <Select
              value={filiereId}
              onChange={(v) => {
                setFiliereId(v);
                setSpecializationId("");
              }}
              aria-label={t("admin.allFilieres")}
              options={[
                { value: "", label: t("admin.allFilieres") },
                ...filiereOptions.map((f) => ({ value: f.id, label: f.name })),
              ]}
            />

            {/* The level, before the specialization it narrows: a licence one is not a master's. */}
            <Select
              value={level}
              onChange={(v) => {
                setLevel(v as SpecLevel | "");
                // A specialization of another level no longer fits.
                const sp = specList.find((s) => s.id === specializationId);
                if (v && sp && sp.level !== v) setSpecializationId("");
              }}
              aria-label={t("admin.allLevels")}
              options={[
                { value: "", label: t("admin.allLevels") },
                ...SPEC_LEVELS.map((lv) => ({ value: lv, label: t(SPEC_LEVEL_KEY[lv]) })),
              ]}
            />

            <Select
              value={specializationId}
              onChange={setSpecializationId}
              aria-label={t("admin.allSpecializations")}
              options={[
                { value: "", label: t("admin.allSpecializations") },
                ...specOptions.map((sp) => ({ value: sp.id, label: sp.name })),
              ]}
            />

            <Select
              value={academicYearId}
              onChange={setAcademicYearId}
              aria-label={t("admin.allYears")}
              options={[
                { value: "", label: t("admin.allYears") },
                ...(years ?? []).map((y: any) => ({
                  value: y.id,
                  label: y.title,
                })),
              ]}
            />
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3">
          <span className="text-sm font-semibold text-forest">
            {t("admin.selectedN", { n: selected.size })}
            {bulkBusy && bulkProgress.total > 0 && (
              <span className="ms-2 font-normal text-clay">
                {t("admin.bulkProgress", bulkProgress)}
              </span>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={bulkApprove}
              disabled={bulkBusy || approvable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
            >
              <Check size={14} />
              {t("admin.approve")} ({approvable.length})
            </button>
            <button
              onClick={bulkPublish}
              disabled={bulkBusy || publishable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep disabled:opacity-40"
            >
              <Send size={14} />
              {t("admin.publish")} ({publishable.length})
            </button>
            <button
              onClick={bulkUnpublish}
              disabled={bulkBusy || unpublishable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 px-3.5 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-40"
            >
              <EyeOff size={14} />
              {t("admin.unpublish")} ({unpublishable.length})
            </button>
            <button
              onClick={() => setBulkDialog("reject")}
              disabled={bulkBusy || rejectable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-3.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
            >
              <X size={14} />
              {t("admin.reject")} ({rejectable.length})
            </button>
            <button
              onClick={bulkArchive}
              disabled={bulkBusy || archivable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3.5 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              <Archive size={14} />
              {t("admin.archive")} ({archivable.length})
            </button>
            <button
              onClick={bulkUnarchive}
              disabled={bulkBusy || unarchivable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3.5 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              <Undo2 size={14} />
              {t("admin.unarchive")} (
              {unarchivable.length})
            </button>
            <button
              onClick={() => setBulkDialog("delete")}
              disabled={bulkBusy || deletable.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              <Trash2 size={14} />
              {t("admin.delete")} ({deletable.length})
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-clay transition hover:text-forest"
            >
              <X size={14} />
              {t("admin.clearSelection")}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        {/* Changing a filter refetches while the old rows stay on screen —
            this hairline says the table is catching up. */}
        <div className="h-0.5 overflow-hidden bg-transparent">
          {isFetching && !isLoading && (
            <div className="h-full w-1/3 animate-[bulkSweep_1s_ease-in-out_infinite] bg-gold" />
          )}
        </div>
        <div className="max-h-[70dvh] overflow-auto">
          <table ref={stackOnPhone} className="stack-sm w-full text-start">
            <thead className="sticky top-0 z-10">
              <tr className="bg-forest text-cream">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAll}
                    className="size-4 accent-gold"
                    aria-label={t("admin.selectAll")}
                  />
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("admin.topicTitle")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("admin.supervisor")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("admin.specialization")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("admin.statusLabel")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("admin.applicationsCount")}
                </th>
                <th className="px-5 py-3 text-start text-xs font-medium">
                  {t("admin.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {isLoading &&
                Array.from({ length: 5 }).map((_, k) => (
                  <tr key={`sk-${k}`} className="animate-pulse">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 w-full rounded bg-forest/10" />
                    </td>
                  </tr>
                ))}

              {/* A failed request used to fall through to "no topics", so an
                  outage or a spent rate limit looked like an empty database. */}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-2">
                    <ErrorRetry compact title={t("admin.loadFailed")} onRetry={() => refetch()} />
                  </td>
                </tr>
              )}

              {!isLoading && !isError && topics.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <p className="text-sm text-clay">
                      {activeFilters > 0
                        ? t("admin.noResultsFilters")
                        : t("admin.noTopics")}
                    </p>
                    {activeFilters > 0 && (
                      <button
                        onClick={clearFilters}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
                      >
                        <FilterX size={14} />
                        {t("admin.clearFilters")}
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!isError &&
                topics.map((tp) => {
                const checked = selected.has(tp.id);
                return (
                  <tr
                    key={tp.id}
                    className={`transition-colors ${checked ? "bg-gold/5" : "odd:bg-forest/[0.03] hover:bg-forest/7"}`}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(tp.id)}
                        className="size-4 accent-gold"
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => openTopic(tp.id)}
                        className="text-start"
                      >
                        <p className="text-sm font-medium text-forest transition hover:text-gold">
                          {tp.title}
                        </p>
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <UserAvatar user={tp.professor?.user} size={28} />
                        <span className="text-sm text-clay">
                          {profName(tp)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-clay">
                      {tp.specialization?.name ?? <None />}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusChip(tp.status)}`}
                      >
                        {t(`status.${tp.status}`, { defaultValue: tp.status })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {/*
                        العددُ وحده لا يقول شيئاً حين يكون للموضوع سقف: أهو
                        قريبٌ من الإغلاق أم في أوّله؟ فيُعرض مع السقف، ويحمرّ
                        حين يبلغه — فتراه الإدارة قبل أن يشتكي الطالب.
                      */}
                      {(() => {
                        const used = tp._count?.groupRequests ?? 0;
                        const cap = tp.maxRequests ?? null;
                        const full = cap !== null && used >= cap;
                        return (
                          <span
                            title={cap !== null ? t("admin.maxRequests") : undefined}
                            className={`inline-grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                              full
                                ? "bg-brick/15 text-brick"
                                : "bg-forest/10 text-forest"
                            }`}
                          >
                            {cap === null ? used : `${used} / ${cap}`}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditId(tp.id)}
                          title={t("admin.edit")}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-forest/15 px-2.5 py-1.5 text-xs font-medium text-forest/80 transition hover:border-gold hover:bg-gold/10 hover:text-forest"
                        >
                          <Pencil size={13} />
                          {t("admin.edit")}
                        </button>

                        {/*
                          ورقةُ الموافقة لا تُعرض إلّا لموضوعٍ قامت عليه
                          مجموعة: قبل ذلك لا طلبة لها تُسمّيهم.
                        */}
                        {tp.occupancy?.hasGroup && (
                          <button
                            onClick={() => setSupervisionTopicId(tp.id)}
                            title={t("supervision.open")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-forest/15 px-2.5 py-1.5 text-xs font-medium text-forest/80 transition hover:border-gold hover:bg-gold/10 hover:text-forest"
                          >
                            <FileCheck2 size={13} />
                            {t("supervision.sheet")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-forest/10 px-5 py-3">
          <p className="text-xs text-clay">
            {t("admin.showingRange", {
              from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label={t("admin.proj.prev")}
              className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              {"\u2039"}
            </button>
            <span className="px-3 text-sm text-forest">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label={t("admin.proj.next")}
              className="grid size-8 place-items-center rounded-lg border border-forest/15 text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >
              {"\u203a"}
            </button>
          </div>
        </div>
      </div>

      {/* Create-topic dialog — the topic alone, no group */}
      <TopicDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <TopicImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <AssignedTopicImportDialog open={assignedImportOpen} onClose={() => setAssignedImportOpen(false)} />

      {/* Assign-topic dialog */}
      <AssignedTopicDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />

      {/* Edit-topic dialog */}
      <EditAssignedTopicDialog
        topicId={editId}
        onClose={() => setEditId(null)}
      />

      {/*
        الحذف والرفض على المحدَّد نافذةٌ واحدة بخطوتين: مراجعة ما سيقع عليه
        الإجراء وما يُستثنى، ثمّ التأكيد. وتُركَّب عند الفتح فقط، فتبدأ نظيفة.
      */}
      {bulkDialog && (
        <BulkTopicsDialog
          mode={bulkDialog}
          topics={selectedTopics}
          busy={bulkBusy}
          progress={bulkProgress}
          onClose={() => setBulkDialog(null)}
          onConfirm={(reason) =>
            bulkDialog === "delete" ? bulkDelete() : bulkReject(reason)
          }
        />
      )}

      {scanOpen && <ScanDialog onClose={() => setScanOpen(false)} />}
      {typesOpen && <TopicTypesDialog departmentId={departmentId || undefined} onClose={() => setTypesOpen(false)} />}
      {titlesOpen && (
        <TopicTitlesDialog
          scope={{
            academicYearId: academicYearId || undefined,
            professorId: professorId || undefined,
            facultyId: facultyId || undefined,
            departmentId: departmentId || undefined,
            filiereId: filiereId || undefined,
            specializationId: specializationId || undefined,
            level: level || undefined,
          }}
          years={years ?? []}
          onClose={() => setTitlesOpen(false)}
        />
      )}

      {exportOpen && (
        <TopicExportDialog
          scope={{
            search: debouncedSearch || undefined,
            status: status || undefined,
            professorId: professorId || undefined,
            academicYearId: academicYearId || undefined,
            facultyId: facultyId || undefined,
            departmentId: departmentId || undefined,
            filiereId: filiereId || undefined,
            specializationId: specializationId || undefined,
            level: level || undefined,
          }}
          chips={
            [
              facultyById.get(facultyId)?.name,
              deptOptions.find((d) => d.id === departmentId)?.name,
              filiereOptions.find((f) => f.id === filiereId)?.name,
              level ? t(SPEC_LEVEL_KEY[level]) : undefined,
              specList.find((s) => s.id === specializationId)?.name,
              status ? t(`status.${status}`) : undefined,
              (() => {
                const p = professors.find((x: any) => x.id === professorId);
                return p ? personName(p.user) || p.universityEmail : undefined;
              })(),
              debouncedSearch ? t("admin.topicExport.searchChip", { q: debouncedSearch }) : undefined,
            ].filter(Boolean) as string[]
          }
          count={data?.total}
          yearTitle={(years ?? []).find((y) => y.id === academicYearId)?.title}
          onClose={() => setExportOpen(false)}
        />
      )}

      {supervisionTopicId && (
        <SupervisionDialog
          topicId={supervisionTopicId}
          onClose={() => setSupervisionTopicId(null)}
        />
      )}
    </div>
  );
}
