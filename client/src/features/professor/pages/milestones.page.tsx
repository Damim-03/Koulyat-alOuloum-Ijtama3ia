import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Milestone as MileIcon,
  CalendarDays,
} from "lucide-react";

import {
  useGroups,
  useMilestones,
  useCreateMilestone,
  useDeleteMilestone,
  useUpdateMilestone,
} from "../hooks/Professor-hook";

import { StatusBadge } from "../components/status-badge";

type MilestoneStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "overdue";

const NEXT: Record<MilestoneStatus, MilestoneStatus> = {
  pending: "in_progress",
  in_progress: "completed",
  completed: "pending",
  overdue: "in_progress",
};

export function ProfessorMilestonesPage() {
  const { t } = useTranslation();

  const { data: groups, isLoading: loadingGroups } = useGroups();

  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    if (!groupId && groups?.length) {
      setGroupId(groups[0].id);
    }
  }, [groups, groupId]);

  const { data: milestones, isLoading } = useMilestones(groupId);

  const create = useCreateMilestone(groupId);
  const del = useDeleteMilestone(groupId);
  const update = useUpdateMilestone(groupId);

  const [form, setForm] = useState({
    title: "",
    deadline: "",
    order: 1,
  });

  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!groupId || !form.title.trim()) return;

    create.mutate(
      {
        title: form.title.trim(),
        deadline: form.deadline,
        order: Number(form.order),
      },
      {
        onSuccess: () =>
          setForm((prev) => ({
            title: "",
            deadline: "",
            order: prev.order + 1,
          })),
      }
    );
  };

  const field =
    "rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm text-forest outline-none focus:border-gold";

  if (loadingGroups) {
    return (
      <div className="h-64 animate-pulse rounded-2xl bg-forest/5" />
    );
  }

  if (!groups?.length) {
    return (
      <div>
        <h2 className="mb-4 font-serif text-2xl font-bold text-forest">
          {t("dash.milestones")}
        </h2>

        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-forest/15 bg-cream-card py-16 text-center">
          <MileIcon size={36} className="mb-2 text-forest/30" />
          <p className="text-sm text-clay">
            {t("pro.noGroups")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 font-serif text-2xl font-bold text-forest">
        {t("dash.milestones")}
      </h2>

      {/* Group Selector */}
      <div className="mb-5">
        <label className="mb-1 block text-[13px] font-medium text-forest">
          {t("pro.selectGroup")}
        </label>

        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className={`${field} w-full max-w-md`}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.topic?.title ?? g.id}
            </option>
          ))}
        </select>
      </div>

      {/* Add Form */}
      <form
        onSubmit={add}
        className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-forest/10 bg-cream-card p-4"
      >
        <div className="flex-1">
          <label className="mb-1 block text-[12px] text-clay">
            {t("pro.title")}
          </label>

          <input
            className={`${field} w-full`}
            value={form.title}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                title: e.target.value,
              }))
            }
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-[12px] text-clay">
            {t("pro.deadline")}
          </label>

          <input
            type="date"
            className={field}
            value={form.deadline}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                deadline: e.target.value,
              }))
            }
            required
          />
        </div>

        <div className="w-20">
          <label className="mb-1 block text-[12px] text-clay">
            {t("pro.order")}
          </label>

          <input
            type="number"
            min={1}
            className={`${field} w-full`}
            value={form.order}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                order: Number(e.target.value),
              }))
            }
            required
          />
        </div>

        <button
          type="submit"
          disabled={create.isPending}
          className="flex h-9.5 items-center gap-1.5 rounded-lg bg-linear-to-br from-gold to-gold-soft px-4 text-sm font-bold text-forest-deep disabled:opacity-60"
        >
          <Plus size={15} />
          {t("pro.addMilestone")}
        </button>
      </form>

      {/* Milestones */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-forest/5"
            />
          ))}
        </div>
      ) : !milestones?.length ? (
        <div className="rounded-2xl border-2 border-dashed border-forest/15 bg-cream-card py-12 text-center text-sm text-clay">
          {t("pro.noMilestones")}
        </div>
      ) : (
        <div className="space-y-2">
          {milestones
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-forest/10 bg-cream-card p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-forest/10 text-[12px] font-bold text-forest">
                    {m.order}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-forest">
                      {m.title}
                    </p>

                    <p className="flex items-center gap-1 text-[11px] text-clay">
                      <CalendarDays size={12} />
                      {m.deadline
                        ? new Date(m.deadline).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      update.mutate({
                        id: m.id,
                        data: {
                          status:
                            NEXT[m.status as MilestoneStatus],
                        },
                      })
                    }
                    title="Change status"
                  >
                    <StatusBadge status={m.status} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t("pro.confirmDelete"))) {
                        del.mutate(m.id);
                      }
                    }}
                    className="grid size-8 place-items-center rounded-lg text-red-500/60 transition hover:bg-red-500/5 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}