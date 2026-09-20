import Link from "next/link";

import {
  addApplication,
  removeApplication,
  updateApplicationStatus,
} from "./actions";
import { STATUSES, isClosed } from "@/lib/application-status";
import { DeleteRowButton } from "@/components/delete-row-button";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { StatusSelect } from "@/components/status-select";
import { daysUntilTimestamp, formatDeadline } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

type Application = {
  id: string;
  company: string;
  role: string | null;
  season: string | null;
  status: string;
  deadline: string | null;
  posting_url: string | null;
  memo: string | null;
};

const FIELDS: Field[] = [
  { name: "company", label: "기업", required: true, placeholder: "○○전자" },
  { name: "role", label: "직무", placeholder: "경영지원" },
  { name: "season", label: "시즌", placeholder: "2026 상반기" },
  {
    name: "status",
    label: "전형 단계",
    type: "select",
    options: [...STATUSES],
  },
  {
    name: "deadline",
    label: "마감",
    type: "date",
    hint: "자소서 마감일",
  },
  { name: "posting_url", label: "공고 링크", placeholder: "https://..." },
  { name: "memo", label: "메모", type: "textarea" },
];

/** CLAUDE.md UX 원칙: 진행 중 파랑, 합격 초록, 탈락 회색 */
function statusTone(status: string): string {
  if (status === "최종 합격") return "bg-green-100 text-green-800";
  if (status === "탈락") return "bg-gray-100 text-gray-500";
  if (status === "작성 중") return "bg-gray-100 text-gray-700";
  return "bg-blue-100 text-blue-800";
}

/** 마감 임박만 빨강. 끝난 전형은 마감일을 강조하지 않는다. */
function DeadlineText({
  deadline,
  status,
}: {
  deadline: string | null;
  status: string;
}) {
  if (!deadline) return null;

  const closed = isClosed(status);
  const days = daysUntilTimestamp(deadline);
  const urgent = !closed && days >= 0 && days <= 3;
  const passed = days < 0;

  return (
    <span
      className={
        "text-xs " +
        (urgent ? "font-bold text-red-600" : passed ? "text-gray-400" : "text-gray-500")
      }
    >
      {formatDeadline(deadline)}
      {closed || passed ? null : ` (D-${days})`}
      {passed ? " 마감됨" : null}
    </span>
  );
}

function Card({ item }: { item: Application }) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{item.company}</p>
          {item.role ? (
            <p className="truncate text-sm text-gray-500">{item.role}</p>
          ) : null}
        </div>
        <DeleteRowButton
          action={removeApplication}
          id={item.id}
          label={item.company}
        />
      </div>

      {item.season ? (
        <p className="mt-1 text-xs text-gray-400">{item.season}</p>
      ) : null}

      <div className="mt-2">
        <DeadlineText deadline={item.deadline} status={item.status} />
      </div>

      {item.memo ? (
        <p className="mt-2 line-clamp-3 text-xs whitespace-pre-wrap text-gray-600">
          {item.memo}
        </p>
      ) : null}

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
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            공고
          </a>
        ) : null}
      </div>
    </li>
  );
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const isTable = view === "table";

  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("*")
    .order("deadline", { ascending: true, nullsFirst: false });

  const items = (data ?? []) as Application[];

  const toggle = (
    <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
      <Link
        href="/applications"
        className={
          "px-3 py-1.5 font-medium " +
          (isTable ? "text-gray-600 hover:bg-gray-50" : "bg-blue-600 text-white")
        }
      >
        칸반
      </Link>
      <Link
        href="/applications?view=table"
        className={
          "px-3 py-1.5 font-medium " +
          (isTable ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50")
        }
      >
        표
      </Link>
    </div>
  );

  return (
    <PageShell
      title="지원 현황"
      description={`전체 ${items.length}곳`}
      actions={toggle}
    >
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
          아직 등록한 지원이 없습니다. 아래에서 추가해 보세요.
        </p>
      ) : isTable ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">기업</th>
                <th className="px-3 py-2 font-medium">직무</th>
                <th className="px-3 py-2 font-medium">시즌</th>
                <th className="px-3 py-2 font-medium">마감</th>
                <th className="px-3 py-2 font-medium">단계</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium">{item.company}</td>
                  <td className="px-3 py-2 text-gray-600">{item.role ?? "-"}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {item.season ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    <DeadlineText
                      deadline={item.deadline}
                      status={item.status}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusSelect
                      action={updateApplicationStatus}
                      id={item.id}
                      status={item.status}
                      statuses={STATUSES}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DeleteRowButton
                      action={removeApplication}
                      id={item.id}
                      label={item.company}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // 모바일에서는 가로로 밀어서 본다.
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex gap-3 md:grid md:grid-cols-3 lg:grid-cols-6">
            {STATUSES.map((status) => {
              const column = items.filter((item) => item.status === status);
              return (
                <section
                  key={status}
                  className="flex w-64 shrink-0 flex-col gap-2 md:w-auto"
                >
                  <h2 className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className={
                        "rounded px-2 py-0.5 text-xs " + statusTone(status)
                      }
                    >
                      {status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {column.length}
                    </span>
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {column.map((item) => (
                      <Card key={item.id} item={item} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <RecordForm
        action={addApplication}
        fields={FIELDS}
        openLabel="지원 추가"
      />
    </PageShell>
  );
}
