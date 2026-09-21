import Link from "next/link";
import { redirect } from "next/navigation";

import { createShare, revokeShare } from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { PageShell } from "@/components/page-shell";
import { RecordForm, type Field } from "@/components/record-form";
import { Card, CardHeader, EmptyState, Tag } from "@/components/ui/primitives";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOwnClient } from "@/lib/supabase/server";

type ShareRow = {
  id: string;
  owner_id: string;
  grantee_id: string;
  application_id: string | null;
  scope: string;
  memo: string | null;
};

const SCOPE_LABEL: Record<string, string> = {
  essays: "자소서만",
  interviews: "면접 복기만",
  both: "자소서 + 면접",
};

export default async function SharingPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const { owner } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { supabase, userId } = await createOwnClient();

  const [shareResult, appResult] = await Promise.all([
    supabase.from("shares").select("*").order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select("id, company, season")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const shares = (shareResult.data ?? []) as ShareRow[];
  const given = shares.filter((s) => s.owner_id === userId);
  const received = shares.filter((s) => s.grantee_id === userId);

  // 이름 표시용. 상대 프로필은 RLS 로 막혀 있어 서버 키로 이름만 가져온다.
  const admin = createAdminClient();
  const otherIds = [
    ...new Set([
      ...given.map((s) => s.grantee_id),
      ...received.map((s) => s.owner_id),
    ]),
  ];
  const { data: others } = otherIds.length
    ? await admin
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", otherIds)
    : { data: [] };

  const nameOf = new Map(
    (others ?? []).map((row) => {
      const r = row as { user_id: string; username: string; display_name: string };
      return [r.user_id, `${r.display_name}(@${r.username})`];
    }),
  );

  const myApps = (appResult.data ?? []) as {
    id: string;
    company: string;
    season: string | null;
  }[];
  const appLabel = new Map(
    myApps.map((a) => [a.id, [a.company, a.season].filter(Boolean).join(" · ")]),
  );

  /* ---------------- 공유받은 내용 보기 ---------------- */
  let viewing: {
    ownerName: string;
    essays: { id: string; question: string; answer: string | null }[];
    questions: { id: string; question: string; my_answer: string | null }[];
  } | null = null;

  if (owner && received.some((s) => s.owner_id === owner)) {
    // RLS 가 공유 범위 밖의 행은 걸러 준다. 여기서는 소유자만 지정하면 된다.
    const [essayResult, questionResult] = await Promise.all([
      supabase
        .from("essays")
        .select("id, question, answer")
        .eq("user_id", owner)
        .order("created_at", { ascending: false }),
      supabase
        .from("interview_questions")
        .select("id, question, my_answer")
        .eq("user_id", owner)
        .order("created_at", { ascending: false }),
    ]);

    viewing = {
      ownerName: nameOf.get(owner) ?? "상대",
      essays: (essayResult.data ?? []) as never,
      questions: (questionResult.data ?? []) as never,
    };
  }

  const fields: Field[] = [
    {
      name: "username",
      label: "상대방 아이디",
      required: true,
      placeholder: "friend01",
    },
    {
      name: "scope",
      label: "무엇을",
      type: "select",
      choices: [
        { value: "both", label: "자소서 + 면접" },
        { value: "essays", label: "자소서만" },
        { value: "interviews", label: "면접 복기만" },
      ],
    },
    {
      name: "application_id",
      label: "범위",
      type: "select",
      wide: true,
      choices: [
        { value: "", label: "내 지원 전체" },
        ...myApps.map((a) => ({
          value: a.id,
          label: [a.company, a.season].filter(Boolean).join(" · "),
        })),
      ],
      hint: "특정 기업 하나만 보여 줄 수도 있습니다",
    },
    { name: "memo", label: "메모", placeholder: "스터디 같이 하는 친구", wide: true },
  ];

  return (
    <PageShell
      title="공유"
      description="자소서와 면접 기록을 친구에게 읽기 전용으로 보여 줍니다."
    >
      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-500">
        공유는 <strong>읽기 전용</strong>입니다. 상대는 고치거나 지울 수
        없습니다. 언제든 회수할 수 있고, 회수하면 바로 안 보입니다. 프로필,
        공부 기록, 목표·할 일은 공유되지 않습니다.
      </p>

      {/* ---------------- 내가 공유한 것 ---------------- */}
      <Card>
        <CardHeader title="내가 공유한 것" count={given.length} />
        {given.length === 0 ? (
          <EmptyState text="아직 공유한 것이 없습니다." />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {given.map((share) => (
              <li
                key={share.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {nameOf.get(share.grantee_id) ?? "알 수 없는 사용자"}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Tag tone="brand">{SCOPE_LABEL[share.scope]}</Tag>
                    <Tag>
                      {share.application_id
                        ? (appLabel.get(share.application_id) ?? "삭제된 지원")
                        : "지원 전체"}
                    </Tag>
                  </p>
                  {share.memo ? (
                    <p className="mt-1 text-xs text-ink-400">{share.memo}</p>
                  ) : null}
                </div>
                <DeleteRowButton
                  action={revokeShare}
                  id={share.id}
                  label={`${nameOf.get(share.grantee_id) ?? "상대"} 공유`}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------------- 나에게 공유된 것 ---------------- */}
      <Card>
        <CardHeader title="나에게 공유된 것" count={received.length} />
        {received.length === 0 ? (
          <EmptyState text="아직 공유받은 것이 없습니다." />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {received.map((share) => (
              <li key={share.id} className="py-3">
                <Link
                  href={`/sharing?owner=${share.owner_id}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {nameOf.get(share.owner_id) ?? "알 수 없는 사용자"}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Tag tone="brand">{SCOPE_LABEL[share.scope]}</Tag>
                      {share.application_id ? <Tag>기업 1곳</Tag> : <Tag>전체</Tag>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-brand-600">
                    보기
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------------- 공유받은 내용 ---------------- */}
      {viewing ? (
        <Card>
          <CardHeader title={`${viewing.ownerName} 님이 공유한 내용`} />

          <p className="mb-3 text-sm font-medium text-ink-700">
            자소서 {viewing.essays.length}건
          </p>
          {viewing.essays.length === 0 ? (
            <p className="mb-4 text-sm text-ink-400">공유된 자소서가 없습니다.</p>
          ) : (
            <ul className="mb-4 flex flex-col gap-2">
              {viewing.essays.map((essay) => (
                <li
                  key={essay.id}
                  className="rounded-lg border border-line p-3"
                >
                  <p className="wrap-anywhere whitespace-pre-wrap text-sm font-medium">
                    {essay.question}
                  </p>
                  {essay.answer ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer py-1 text-sm font-medium text-brand-600">
                        답변 보기
                      </summary>
                      <p className="mt-2 wrap-anywhere whitespace-pre-wrap text-sm text-ink-700">
                        {essay.answer}
                      </p>
                    </details>
                  ) : (
                    <p className="mt-1 text-xs text-ink-400">답변이 비어 있습니다.</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mb-3 text-sm font-medium text-ink-700">
            면접 질문 {viewing.questions.length}건
          </p>
          {viewing.questions.length === 0 ? (
            <p className="text-sm text-ink-400">공유된 면접 질문이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {viewing.questions.map((item) => (
                <li key={item.id} className="rounded-lg border border-line p-3">
                  <p className="wrap-anywhere whitespace-pre-wrap text-sm font-medium">
                    {item.question}
                  </p>
                  {item.my_answer ? (
                    <p className="mt-1 wrap-anywhere whitespace-pre-wrap text-sm text-ink-700">
                      {item.my_answer}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <RecordForm
        action={createShare}
        fields={fields}
        openLabel="공유 추가"
        submitLabel="공유하기"
      />
    </PageShell>
  );
}
