"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";

import { removeApplication, updateApplication } from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { EditableRow } from "@/components/editable-row";
import { EditableTableRow } from "@/components/editable-table-row";
import { type Field } from "@/components/form-fields";
import { StatusSelect } from "@/components/status-select";
import { FilterChips } from "@/components/ui/filter-chips";
import { EmptyState, Tag, inputClass, type Tone } from "@/components/ui/primitives";
import { STATUSES, isClosed } from "@/lib/application-status";
import { updateApplicationStatus } from "./actions";

export type Application = {
  id: string;
  company: string;
  role: string | null;
  season: string | null;
  status: string;
  deadline: string | null;
  posting_url: string | null;
  memo: string | null;
  created_at: string;
  /** 서버에서 서울 기준으로 계산해 넘겨 준다 */
  deadlineDate: string | null;
  deadlineText: string | null;
  daysLeft: number | null;
};

const VIEW_KEY = "job-planner.applications.view";
const URGENT_DAYS = 3;

type View = "table" | "card";
type Sort = "deadline" | "recent" | "company";

const SORTS: { value: Sort; label: string }[] = [
  { value: "deadline", label: "마감 임박순" },
  { value: "recent", label: "최근 추가순" },
  { value: "company", label: "기업명순" },
];

/** 단계 태그의 색. 합격 초록, 종료 회색, 나머지 파랑. */
function statusTone(status: string): Tone {
  if (status === "최종 합격") return "success";
  if (status === "탈락") return "muted";
  if (status === "작성 중") return "muted";
  return "brand";
}

function DeadlineTag({ item }: { item: Application }) {
  if (item.daysLeft === null) return null;

  const closed = isClosed(item.status);
  if (closed) return null;

  if (item.daysLeft < 0) return <Tag tone="muted">마감됨</Tag>;
  if (item.daysLeft <= URGENT_DAYS)
    return (
      <Tag tone="danger">
        {item.daysLeft === 0 ? "D-DAY" : `D-${item.daysLeft}`}
      </Tag>
    );
  return <Tag tone="brand">{`D-${item.daysLeft}`}</Tag>;
}

export function ApplicationsView({
  items,
  fields,
}: {
  items: Application[];
  fields: Field[];
}) {
  const [status, setStatus] = useState("전체");
  const [sort, setSort] = useState<Sort>("deadline");

  // null = 아직 저장된 선택이 없음. 그동안은 화면 폭에 따라 CSS 로 고른다.
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "table" || saved === "card") setView(saved);
    } catch {
      // 사생활 보호 모드 등에서 저장소를 못 읽어도 화면은 정상 동작해야 한다.
    }
  }, []);

  function chooseView(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // 저장에 실패해도 이번 화면에서는 선택이 적용된다.
    }
  }

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    }
    return [
      { value: "전체", label: "전체", count: items.length },
      ...STATUSES.map((s) => ({
        value: s,
        label: s,
        count: counts.get(s) ?? 0,
      })),
    ];
  }, [items]);

  const visible = useMemo(() => {
    const filtered =
      status === "전체" ? items : items.filter((i) => i.status === status);

    const sorted = [...filtered];
    if (sort === "deadline") {
      // 마감 없는 것은 뒤로 보낸다. 마감이 지난 것도 뒤로.
      sorted.sort((a, b) => {
        const rank = (x: Application) =>
          x.daysLeft === null ? 2 : x.daysLeft < 0 ? 1 : 0;
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return (a.daysLeft ?? 0) - (b.daysLeft ?? 0);
      });
    } else if (sort === "recent") {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      sorted.sort((a, b) => a.company.localeCompare(b.company, "ko"));
    }
    return sorted;
  }, [items, status, sort]);

  const toggle = (
    <div
      role="group"
      aria-label="보기 방식"
      className="flex overflow-hidden rounded-lg border border-line"
    >
      {(
        [
          { value: "card" as const, Icon: LayoutGrid, label: "카드" },
          { value: "table" as const, Icon: Table2, label: "표" },
        ]
      ).map(({ value, Icon, label }) => {
        // 저장된 선택이 없으면 화면 폭 기준으로 강조한다 (모바일 카드 / 데스크톱 표).
        const activeClass =
          view === value
            ? "bg-brand-600 text-white"
            : view !== null
              ? "bg-surface text-ink-500"
              : value === "card"
                ? "bg-brand-600 text-white md:bg-surface md:text-ink-500"
                : "bg-surface text-ink-500 md:bg-brand-600 md:text-white";

        return (
          <button
            key={value}
            type="button"
            onClick={() => chooseView(value)}
            aria-label={`${label} 보기`}
            className={"flex h-11 items-center gap-1.5 px-3 text-sm font-medium " + activeClass}
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );

  const cards = (
    <ul className="flex flex-col gap-2">
      {visible.map((item) => (
        <li key={item.id}>
          <EditableRow
            action={updateApplication}
            fields={fields}
            defaults={{
              company: item.company,
              role: item.role,
              season: item.season,
              status: item.status,
              deadline: item.deadlineDate ?? "",
              posting_url: item.posting_url,
              memo: item.memo,
            }}
            id={item.id}
            title={item.company}
            deleteSlot={
              <DeleteRowButton
                action={removeApplication}
                id={item.id}
                label={item.company}
              />
            }
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="min-w-0 truncate font-medium">{item.company}</p>
                <Tag tone={statusTone(item.status)}>{item.status}</Tag>
                <DeadlineTag item={item} />
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-500">
                {[item.role, item.season].filter(Boolean).join(" · ") || "—"}
              </p>
              {item.deadlineText ? (
                <p className="mt-0.5 truncate text-xs text-ink-400">
                  마감 {item.deadlineText}
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <StatusSelect
                action={updateApplicationStatus}
                id={item.id}
                status={item.status}
                statuses={STATUSES}
              />
              {item.posting_url ? (
                <a
                  href={item.posting_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="px-1 py-2 text-xs font-medium text-brand-600 hover:underline"
                >
                  공고 보기
                </a>
              ) : null}
            </div>
          </EditableRow>
        </li>
      ))}
    </ul>
  );

  const table = (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="border-b border-line bg-muted-100 text-left text-xs text-ink-500">
          <tr>
            <th className="px-3 py-2.5 font-medium">기업</th>
            <th className="px-3 py-2.5 font-medium">직무</th>
            <th className="px-3 py-2.5 font-medium">시즌</th>
            <th className="px-3 py-2.5 font-medium">마감</th>
            <th className="px-3 py-2.5 font-medium">단계</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {visible.map((item) => (
            <EditableTableRow
              key={item.id}
              action={updateApplication}
              fields={fields}
              defaults={{
                company: item.company,
                role: item.role,
                season: item.season,
                status: item.status,
                deadline: item.deadlineDate ?? "",
                posting_url: item.posting_url,
                memo: item.memo,
              }}
              id={item.id}
              title={item.company}
              columnCount={6}
              deleteSlot={
                <DeleteRowButton
                  action={removeApplication}
                  id={item.id}
                  label={item.company}
                />
              }
            >
              <td className="px-3 py-2.5 font-medium">{item.company}</td>
              <td className="px-3 py-2.5 text-ink-500">{item.role ?? "—"}</td>
              <td className="px-3 py-2.5 text-ink-500">{item.season ?? "—"}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-ink-500">
                    {item.deadlineText ?? "—"}
                  </span>
                  <DeadlineTag item={item} />
                </div>
              </td>
              <td className="px-3 py-2.5">
                <StatusSelect
                  action={updateApplicationStatus}
                  id={item.id}
                  status={item.status}
                  statuses={STATUSES}
                />
              </td>
            </EditableTableRow>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <FilterChips
        chips={chips}
        value={status}
        onChange={setStatus}
        label="전형 단계 거르기"
      />

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-ink-500">
          <span className="sr-only sm:not-sr-only">정렬</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
            className={inputClass + " h-11 w-auto"}
            aria-label="정렬 기준"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {toggle}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          text={
            items.length === 0
              ? "아직 등록한 지원이 없습니다."
              : `"${status}" 단계에 해당하는 지원이 없습니다.`
          }
        />
      ) : view === null ? (
        // 저장된 선택이 없을 때: 모바일 카드, 데스크톱 표
        <>
          <div className="md:hidden">{cards}</div>
          <div className="hidden md:block">{table}</div>
        </>
      ) : view === "card" ? (
        cards
      ) : (
        table
      )}
    </div>
  );
}
