import { useMemo, useState } from "react";
import {
  Building2,
  Network,
  Layers3,
  GitBranch,
  Plus,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  Save,
  Sparkles,
  AlertCircle,
  Lock,
} from "lucide-react";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import { useTranslation } from "react-i18next";
import {
  useFaculties,
  useDepartments,
  useDomains,
  useFilieres,
  useSpecializations,
  useCreateAcademicStructure,
} from "../../../hooks/admin-hook";
import type {
  AcademicStructurePayload,
  StructureRef,
  StructureSpecialization,
} from "../../../../../types/admin";

//
// ─── REFS ────────────────────────────────────────────────────
//
// Dropdowns mix rows that already exist in the database with rows being
// drafted right now. Both are encoded as one string so a <select> can hold
// either: "existing:<uuid>" or "new:<draft-key>".
//

const encodeRef = (kind: "new" | "existing", value: string) =>
  `${kind}:${value}`;

function decodeRef(ref: string): StructureRef {
  const at = ref.indexOf(":");
  return {
    kind: ref.slice(0, at) as "new" | "existing",
    value: ref.slice(at + 1),
  };
}

//
// ─── DRAFT SHAPES ────────────────────────────────────────────
//

interface DraftDepartment {
  key: string;
  name: string;
  code: string;
}
interface DraftDomain {
  key: string;
  name: string;
  code: string;
  departmentRef: string;
}
interface DraftFiliere {
  key: string;
  name: string;
  code: string;
  departmentRef: string;
  domainRef: string; // "" = no domain
  specializations: StructureSpecialization[];
}

// Keys, not copy: this array is built once at import time.
const LEVELS: { value: StructureSpecialization["level"]; labelKey: string }[] = [
  { value: "licence", labelKey: "stu.levelLicence" },
  { value: "master", labelKey: "stu.levelMaster" },
  { value: "doctorate", labelKey: "stu.levelDoctorate" },
];

const STEPS = [
  { titleKey: "admin.faculty", Icon: Building2 },
  { titleKey: "admin.departments", Icon: Network },
  { titleKey: "admin.statDomains", Icon: Layers3 },
  { titleKey: "admin.filieresAndSpecializations", Icon: GitBranch },
] as const;

let counter = 0;
const nextKey = (prefix: string) => `${prefix}-${++counter}`;

const norm = (s: string) => s.trim().toLowerCase();

/** Derives a code suggestion from an Arabic or Latin name. */
function suggestCode(name: string, prefix: string): string {
  const latin = name
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim();
  if (latin) {
    return (
      prefix +
      "-" +
      latin
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 6)
    );
  }
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

//
// ─── COMPONENT ───────────────────────────────────────────────
//

export function AcademicStructureWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: faculties } = useFaculties();
  const { data: allDepartments } = useDepartments();
  const { data: allDomains } = useDomains();
  const { data: allFilieres } = useFilieres();
  const { data: allSpecializations } = useSpecializations();
  const createStructure = useCreateAcademicStructure();

  const [step, setStep] = useState(0);

  // Step 1
  const [facultyMode, setFacultyMode] = useState<"new" | "existing">("new");
  const [facultyId, setFacultyId] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [facultyCode, setFacultyCode] = useState("");

  // Steps 2–4
  const [departments, setDepartments] = useState<DraftDepartment[]>([]);
  const [domains, setDomains] = useState<DraftDomain[]>([]);
  const [filieres, setFilieres] = useState<DraftFiliere[]>([]);

  //
  // ── What the chosen faculty already contains ──
  // Shown read-only so the admin can see it and link to it instead of
  // re-creating the same department twice.
  //
  const existing = useMemo(() => {
    if (facultyMode !== "existing" || !facultyId)
      return { departments: [], domains: [], filieres: [] };

    const deps = (allDepartments ?? []).filter(
      (d) => d.facultyId === facultyId,
    );
    const depIds = new Set(deps.map((d) => d.id));
    const doms = (allDomains ?? []).filter((d) => depIds.has(d.departmentId));
    const fils = (allFilieres ?? []).filter((f) => depIds.has(f.departmentId));
    return { departments: deps, domains: doms, filieres: fils };
  }, [facultyMode, facultyId, allDepartments, allDomains, allFilieres]);

  /** How many specializations an existing filiere already has. */
  const specCount = (filiereId: string) =>
    (allSpecializations ?? []).filter((s) => s.filiereId === filiereId).length;

  // Options for the department / domain dropdowns: existing first, then drafts.
  const departmentOptions = useMemo(
    () => [
      ...existing.departments.map((d) => ({
        ref: encodeRef("existing", d.id),
        label: d.name,
        isExisting: true,
      })),
      ...departments.map((d) => ({
        ref: encodeRef("new", d.key),
        label: d.name || t("admin.unnamedDepartment"),
        isExisting: false,
      })),
    ],
    [existing.departments, departments],
  );

  const domainOptionsFor = (departmentRef: string) => {
    const parsed = departmentRef ? decodeRef(departmentRef) : null;
    return [
      ...existing.domains
        .filter(
          (d) => parsed?.kind === "existing" && d.departmentId === parsed.value,
        )
        .map((d) => ({
          ref: encodeRef("existing", d.id),
          label: d.name,
          isExisting: true,
        })),
      ...domains
        .filter((d) => d.departmentRef === departmentRef)
        .map((d) => ({
          ref: encodeRef("new", d.key),
          label: d.name || t("admin.unnamedDomain"),
          isExisting: false,
        })),
    ];
  };

  // Duplicate guards — warn, don't block (the server rejects duplicate codes).
  const existingDeptNames = new Set(existing.departments.map((d) => norm(d.name)));
  const existingDomainNames = new Set(existing.domains.map((d) => norm(d.name)));
  const existingFiliereNames = new Set(existing.filieres.map((f) => norm(f.name)));

  // Only the faculty step is required; every later step may stay empty.
  const facultyReady =
    facultyMode === "existing"
      ? !!facultyId
      : facultyName.trim() !== "" && facultyCode.trim() !== "";

  const rowsComplete = useMemo(
    () =>
      departments.every((d) => d.name.trim() && d.code.trim()) &&
      domains.every((d) => d.name.trim() && d.code.trim() && d.departmentRef) &&
      filieres.every(
        (f) =>
          f.name.trim() &&
          f.code.trim() &&
          f.departmentRef &&
          f.specializations.every((s) => s.name.trim()),
      ),
    [departments, domains, filieres],
  );

  const canSave = facultyReady && rowsComplete && !createStructure.isPending;

  // Domains and filieres need a department — drafted or already existing.
  const hasAnyDepartment = departmentOptions.length > 0;
  const defaultDepartmentRef = departmentOptions[0]?.ref ?? "";

  function save() {
    if (!canSave) return;
    const payload: AcademicStructurePayload = {
      faculty:
        facultyMode === "existing"
          ? { kind: "existing", id: facultyId }
          : { kind: "new", name: facultyName.trim(), code: facultyCode.trim() },
      departments: departments.map((d) => ({
        key: d.key,
        name: d.name.trim(),
        code: d.code.trim(),
      })),
      domains: domains.map((d) => ({
        key: d.key,
        name: d.name.trim(),
        code: d.code.trim(),
        department: decodeRef(d.departmentRef),
      })),
      filieres: filieres.map((f) => ({
        key: f.key,
        name: f.name.trim(),
        code: f.code.trim(),
        department: decodeRef(f.departmentRef),
        domain: f.domainRef ? decodeRef(f.domainRef) : null,
        specializations: f.specializations.map((s) => ({
          name: s.name.trim(),
          level: s.level,
        })),
      })),
    };
    createStructure.mutate(payload, { onSuccess: onClose });
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t("admin.addAcademicStructure")}
      subtitle={t("admin.structureWizardSubtitle")}
      icon={Building2}
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            {createStructure.isPending ? t("admin.savingEllipsis") : t("admin.saveStructure")}
          </button>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-1 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
            >
              <ChevronRight size={16} className="ltr:rotate-180" />{t("admin.previous")}</button>
          )}
          {step < STEPS.length - 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && !facultyReady}
              className="inline-flex items-center gap-1 rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-40"
            >{t("admin.next")}<ChevronLeft size={16} className="ltr:rotate-180" />
            </button>
          )}
          <span className="mr-auto text-xs text-clay">
            {t("admin.stepOf", { current: step + 1, total: STEPS.length })}
          </span>
        </>
      }
    >
      {/* ── stepper ── */}
      <ol className="mb-5 flex items-center gap-1">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          const reachable = i === 0 || facultyReady;
          return (
            <li key={t(s.titleKey)} className="flex flex-1 items-center gap-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(i)}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 transition ${
                  active
                    ? "border-gold bg-gold/10"
                    : done
                      ? "border-forest/15 bg-soft-sage/20"
                      : "border-forest/10 bg-cream-2/50"
                } ${reachable ? "hover:border-gold/60" : "cursor-not-allowed opacity-50"}`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                    active
                      ? "bg-gold text-forest-deep"
                      : done
                        ? "bg-soft-sage text-forest"
                        : "bg-forest/8 text-clay"
                  }`}
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className={`min-w-0 truncate text-xs font-semibold ${
                    active ? "text-forest" : "text-clay"
                  }`}
                >
                  {t(s.titleKey)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* ══ STEP 1 — FACULTY ══ */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["new", t("admin.newFaculty")],
                ["existing", t("admin.existingFaculty")],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setFacultyMode(mode);
                  // Refs point at the previous faculty's rows — drop them.
                  setDomains([]);
                  setFilieres([]);
                }}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  facultyMode === mode
                    ? "border-gold bg-gold/10 text-forest"
                    : "border-forest/15 bg-cream-2 text-clay hover:border-gold/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {facultyMode === "new" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Field label={t("admin.facultyName")} icon={Building2}>
                  <input
                    autoFocus
                    value={facultyName}
                    onChange={(e) => setFacultyName(e.target.value)}
                    className={inputClass}
                    placeholder={t("admin.facultyExamplePlaceholder")}
                  />
                </Field>
              </div>
              <Field label={t("admin.code")} icon={Sparkles}>
                <div className="flex gap-1.5">
                  <input
                    value={facultyCode}
                    onChange={(e) => setFacultyCode(e.target.value)}
                    dir="ltr"
                    className={`${inputClass} font-mono`}
                    placeholder={t("admin.facultyCodePlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFacultyCode(suggestCode(facultyName, "FAC"))
                    }
                    className="shrink-0 rounded-xl border border-forest/20 bg-cream-2 px-2.5 text-xs font-semibold text-forest transition hover:border-gold hover:bg-gold/10"
                  >{t("admin.generate")}</button>
                </div>
              </Field>
            </div>
          ) : (
            <>
              <Field label={t("admin.chooseFaculty")} icon={Building2}>
                <select
                  value={facultyId}
                  onChange={(e) => {
                    setFacultyId(e.target.value);
                    setDomains([]);
                    setFilieres([]);
                  }}
                  className={inputClass}
                >
                  <option value="">{t("admin.selectPlaceholder")}</option>
                  {faculties?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </option>
                  ))}
                </select>
              </Field>

              {/* What this faculty already holds */}
              {facultyId && (
                <div className="rounded-xl border border-forest/10 bg-cream-2/60 px-4 py-3">
                  <p className="mb-2 text-xs font-bold text-forest">{t("admin.facultyCurrentContent")}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-clay">
                    <Chip label={t("admin.departmentWord")} n={existing.departments.length} />
                    <Chip label={t("admin.domainWord")} n={existing.domains.length} />
                    <Chip label={t("admin.filiereWord")} n={existing.filieres.length} />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-clay">
                    {t("admin.existingItemsHint")}
                  </p>
                </div>
              )}
            </>
          )}

          <Note>
            {t("admin.nextStepsOptionalHint")}
          </Note>
        </div>
      )}

      {/* ══ STEP 2 — DEPARTMENTS ══ */}
      {step === 1 && (
        <div className="space-y-2">
          <ExistingBlock
            title={t("admin.existingDepartmentsInFaculty")}
            items={existing.departments.map((d) => ({
              id: d.id,
              label: d.name,
              hint: d.code,
            }))}
          />

          {departments.length === 0 && existing.departments.length === 0 && (
            <Empty label={t("admin.noDepartmentsAddedYet")} />
          )}

          {departments.map((d) => (
            <div key={d.key} className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <NameInput
                    value={d.name}
                    onChange={(v) => patch(setDepartments, d.key, { name: v })}
                    placeholder={t("admin.departmentExamplePlaceholder")}
                    duplicate={
                      !!d.name.trim() && existingDeptNames.has(norm(d.name))
                    }
                  />
                </div>
                <CodeInput
                  value={d.code}
                  onChange={(v) => patch(setDepartments, d.key, { code: v })}
                  onGenerate={() =>
                    patch(setDepartments, d.key, {
                      code: suggestCode(d.name, "DEP"),
                    })
                  }
                />
              </div>
              <RemoveButton
                onClick={() => {
                  const ref = encodeRef("new", d.key);
                  setDepartments((p) => p.filter((x) => x.key !== d.key));
                  setDomains((p) => p.filter((x) => x.departmentRef !== ref));
                  setFilieres((p) => p.filter((x) => x.departmentRef !== ref));
                }}
              />
            </div>
          ))}

          <AddButton
            label={t("admin.addDepartment")}
            onClick={() =>
              setDepartments((p) => [
                ...p,
                { key: nextKey("dep"), name: "", code: "" },
              ])
            }
          />
        </div>
      )}

      {/* ══ STEP 3 — DOMAINS ══ */}
      {step === 2 &&
        (!hasAnyDepartment ? (
          <NeedDepartments onBack={() => setStep(1)} />
        ) : (
          <div className="space-y-2">
            <ExistingBlock
              title={t("admin.existingDomains")}
              items={existing.domains.map((d) => ({
                id: d.id,
                label: d.name,
                hint:
                  existing.departments.find((x) => x.id === d.departmentId)
                    ?.name ?? d.code,
              }))}
            />

            {domains.length === 0 && existing.domains.length === 0 && (
              <Empty label={t("admin.noDomainsAddedYet")} />
            )}

            {domains.map((d) => (
              <div key={d.key} className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
                  <NameInput
                    value={d.name}
                    onChange={(v) => patch(setDomains, d.key, { name: v })}
                    placeholder={t("admin.domainExamplePlaceholder")}
                    duplicate={
                      !!d.name.trim() && existingDomainNames.has(norm(d.name))
                    }
                  />
                  <CodeInput
                    value={d.code}
                    onChange={(v) => patch(setDomains, d.key, { code: v })}
                    onGenerate={() =>
                      patch(setDomains, d.key, {
                        code: suggestCode(d.name, "DOM"),
                      })
                    }
                  />
                  <RefSelect
                    value={d.departmentRef}
                    onChange={(v) =>
                      patch(setDomains, d.key, { departmentRef: v })
                    }
                    options={departmentOptions}
                  />
                </div>
                <RemoveButton
                  onClick={() => {
                    const ref = encodeRef("new", d.key);
                    setDomains((p) => p.filter((x) => x.key !== d.key));
                    setFilieres((p) =>
                      p.map((f) =>
                        f.domainRef === ref ? { ...f, domainRef: "" } : f,
                      ),
                    );
                  }}
                />
              </div>
            ))}

            <AddButton
              label={t("admin.addDomain")}
              onClick={() =>
                setDomains((p) => [
                  ...p,
                  {
                    key: nextKey("dom"),
                    name: "",
                    code: "",
                    departmentRef: defaultDepartmentRef,
                  },
                ])
              }
            />
          </div>
        ))}

      {/* ══ STEP 4 — FILIERES + SPECIALIZATIONS ══ */}
      {step === 3 &&
        (!hasAnyDepartment ? (
          <NeedDepartments onBack={() => setStep(1)} />
        ) : (
          <div className="space-y-3">
            <ExistingBlock
              title={t("admin.existingFilieres")}
              items={existing.filieres.map((f) => ({
                id: f.id,
                label: f.name,
                hint: t("admin.specializationsCount", { count: specCount(f.id) }),
              }))}
            />

            {filieres.length === 0 && existing.filieres.length === 0 && (
              <Empty label={t("admin.noFilieresAddedYet")} />
            )}

            {filieres.map((f) => (
              <div
                key={f.key}
                className="rounded-2xl border border-forest/15 bg-cream-2/50 p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
                    <NameInput
                      value={f.name}
                      onChange={(v) => patch(setFilieres, f.key, { name: v })}
                      placeholder={t("admin.filiereExamplePlaceholder")}
                      duplicate={
                        !!f.name.trim() && existingFiliereNames.has(norm(f.name))
                      }
                    />
                    <CodeInput
                      value={f.code}
                      onChange={(v) => patch(setFilieres, f.key, { code: v })}
                      onGenerate={() =>
                        patch(setFilieres, f.key, {
                          code: suggestCode(f.name, "FIL"),
                        })
                      }
                    />
                    <RefSelect
                      value={f.departmentRef}
                      onChange={(v) =>
                        patch(setFilieres, f.key, {
                          departmentRef: v,
                          domainRef: "", // the old domain belongs to another department
                        })
                      }
                      options={departmentOptions}
                    />
                    <RefSelect
                      value={f.domainRef}
                      onChange={(v) => patch(setFilieres, f.key, { domainRef: v })}
                      options={domainOptionsFor(f.departmentRef)}
                      emptyLabel={t("admin.noDomain")}
                    />
                  </div>
                  <RemoveButton
                    onClick={() =>
                      setFilieres((p) => p.filter((x) => x.key !== f.key))
                    }
                  />
                </div>

                {/* nested specializations */}
                <div className="mt-3 border-t border-forest/10 pt-3 pr-3">
                  <p className="mb-2 text-[11px] font-bold text-clay">{t("admin.specializationsWord")}</p>
                  <div className="space-y-2">
                    {f.specializations.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={s.name}
                          onChange={(e) =>
                            patchSpec(setFilieres, f.key, i, {
                              name: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder={t("admin.specializationExamplePlaceholder")}
                        />
                        <select
                          value={s.level}
                          onChange={(e) =>
                            patchSpec(setFilieres, f.key, i, {
                              level: e.target
                                .value as StructureSpecialization["level"],
                            })
                          }
                          className={`${inputClass} w-32 shrink-0`}
                        >
                          {LEVELS.map((l) => (
                            <option key={l.value} value={l.value}>
                              {t(l.labelKey)}
                            </option>
                          ))}
                        </select>
                        <RemoveButton
                          onClick={() =>
                            setFilieres((p) =>
                              p.map((x) =>
                                x.key === f.key
                                  ? {
                                      ...x,
                                      specializations: x.specializations.filter(
                                        (_, j) => j !== i,
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <AddButton
                    label={t("admin.addSpecializationShort")}
                    onClick={() =>
                      setFilieres((p) =>
                        p.map((x) =>
                          x.key === f.key
                            ? {
                                ...x,
                                specializations: [
                                  ...x.specializations,
                                  { name: "", level: "master" },
                                ],
                              }
                            : x,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ))}

            <AddButton
              label={t("admin.addFiliere")}
              onClick={() =>
                setFilieres((p) => [
                  ...p,
                  {
                    key: nextKey("fil"),
                    name: "",
                    code: "",
                    departmentRef: defaultDepartmentRef,
                    domainRef: "",
                    specializations: [],
                  },
                ])
              }
            />
          </div>
        ))}

      {/* ── summary ── */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-forest/10 pt-4 text-xs text-clay">
        <span className="font-bold text-forest">{t("admin.willCreate")}</span>
        <Chip label={t("admin.departmentWord")} n={departments.length} />
        <Chip label={t("admin.domainWord")} n={domains.length} />
        <Chip label={t("admin.filiereWord")} n={filieres.length} />
        <Chip
          label={t("admin.specializationWord")}
          n={filieres.reduce((t, f) => t + f.specializations.length, 0)}
        />
        {!rowsComplete && (
          <span className="flex items-center gap-1 text-brick">
            <AlertCircle size={13} />{t("admin.fillEmptyFieldsFirst")}</span>
        )}
      </div>
    </FormDialog>
  );
}

//
// ─── SMALL PIECES ────────────────────────────────────────────
//

type Setter<T> = React.Dispatch<React.SetStateAction<T[]>>;

/** Updates one keyed row in a draft list. */
function patch<T extends { key: string }>(
  set: Setter<T>,
  key: string,
  changes: Partial<T>,
) {
  set((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));
}

function patchSpec(
  set: Setter<DraftFiliere>,
  key: string,
  index: number,
  changes: Partial<StructureSpecialization>,
) {
  set((prev) =>
    prev.map((f) =>
      f.key === key
        ? {
            ...f,
            specializations: f.specializations.map((s, i) =>
              i === index ? { ...s, ...changes } : s,
            ),
          }
        : f,
    ),
  );
}

/** Read-only list of rows that already live in the database. */
function ExistingBlock({
  title,
  items,
}: {
  title: string;
  items: { id: string; label: string; hint?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-forest/10 bg-soft-sage/10 px-3 py-2.5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-forest">
        <Lock size={11} className="text-sage" />
        {title}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-cream-card px-2.5 py-1 text-xs text-forest"
          >
            {it.label}
            {it.hint && <span className="text-[10px] text-clay">{it.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RefSelect({
  value,
  onChange,
  options,
  emptyLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { ref: string; label: string; isExisting: boolean }[];
  emptyLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {options.map((o) => (
        <option key={o.ref} value={o.ref}>
          {o.isExisting ? t("admin.existingOption", { name: o.label }) : o.label}
        </option>
      ))}
    </select>
  );
}

function NameInput({
  value,
  onChange,
  placeholder,
  duplicate,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  duplicate?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${duplicate ? "border-brick focus:border-brick focus:ring-brick/20" : ""}`}
        placeholder={placeholder}
      />
      {duplicate && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-brick">
          <AlertCircle size={11} />{t("admin.duplicateNameInFaculty")}</p>
      )}
    </div>
  );
}

function CodeInput({
  value,
  onChange,
  onGenerate,
}: {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
        className={`${inputClass} font-mono`}
        placeholder={t("admin.codePlaceholder")}
      />
      <button
        type="button"
        onClick={onGenerate}
        title={t("admin.generateCodeLong")}
        className="grid w-9 shrink-0 place-items-center rounded-xl border border-forest/20 bg-cream-2 text-clay transition hover:border-gold hover:bg-gold/10 hover:text-forest"
      >
        <Sparkles size={14} />
      </button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 flex items-center gap-1.5 rounded-xl border border-dashed border-forest/25 px-3 py-2 text-sm font-semibold text-forest transition hover:border-gold hover:bg-gold/10"
    >
      <Plus size={15} className="text-gold" />
      {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t("pro.delete")}
      className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl text-clay/60 transition hover:bg-brick/10 hover:text-brick"
    >
      <Trash2 size={15} />
    </button>
  );
}

function Chip({ label, n }: { label: string; n: number }) {
  return (
    <span className="rounded-full bg-forest/8 px-2.5 py-1 font-semibold text-forest">
      {n} {label}
    </span>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-forest/20 py-6 text-center text-sm text-clay">
      {label}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-cream-2 px-4 py-3 text-[11px] leading-relaxed text-clay">
      {children}
    </p>
  );
}

function NeedDepartments({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-dashed border-forest/20 py-8 text-center">
      <p className="mb-3 text-sm text-clay">{t("admin.addDepartmentFirstHint")}</p>
      <button
        type="button"
        onClick={onBack}
        className="rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest/5"
      >{t("admin.backToDepartments")}</button>
    </div>
  );
}
