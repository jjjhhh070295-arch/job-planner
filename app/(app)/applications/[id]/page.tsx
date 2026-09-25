import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { AttachmentPanel } from "@/components/attachment-panel";
import { PageShell } from "@/components/page-shell";
import { Card, CardHeader, EmptyState, Tag } from "@/components/ui/primitives";
import { isClosed } from "@/lib/application-status";
import { DartError, loadCompanyReport } from "@/lib/dart";
import {
  daysUntilTimestamp,
  formatDeadline,
  toDateInput,
} from "@/lib/date";
import { resultTone } from "@/lib/interview";
import type { AttachmentRow } from "@/lib/attachments";
import { createClient, createOwnClient } from "@/lib/supabase/server";

const TABS = [
  { value: "posting", label: "공고·일정" },
  { value: "essays", label: "자소서" },
  { value: "interviews", label: "면접 복기" },
  { value: "company", label: "기업분석" },
];

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.value === rawTab) ? rawTab! : "posting";

  const { supabase, userId } = await createOwnClient();

  // RLS 덕분에 남의 지원 건은 아예 조회되지 않는다.
  const { data: app } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!app) notFound();

  const [essayResult, interviewResult] = await Promise.all([
    supabase
      .from("essays")
      .select("id, question, char_limit, category, answer, is_final")
      .eq("application_id", id)
      .order("created_at"),
    supabase
      .from("interviews")
      .select("id, stage, type, date, result")
      .eq("application_id", id)
      .order("date", { ascending: false, nullsFirst: false }),
  ]);

  const essays = essayResult.data ?? [];
  const interviews = interviewResult.data ?? [];

  // 첨부는 공유 대상이 아니다. 내 것이 아니면 RLS 가 아무것도 내려 주지 않는다.
  const { data: attachmentData } = await supabase
    .from("attachments")
    .select("id, kind, label, storage_path, url, mime_type, size_bytes")
    .eq("application_id", id)
    .order("created_at");
  const attachments = (attachmentData ?? []) as AttachmentRow[];
  const isMine = (app.user_id as string) === userId;

  const deadline = app.deadline as string | null;
  const days = deadline ? daysUntilTimestamp(deadline) : null;

  return (
    <PageShell
      title={app.company as string}
      description={[app.role, app.season].filter(Boolean).join(" · ") || undefined}
      actions={
        <Link
          href="/applications"
          className="tap inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-700 hover:bg-muted-100"
        >
          <ChevronLeft className="size-4" aria-hidden />
          목록
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag
          tone={
            app.status === "최종 합격"
              ? "success"
              : isClosed(app.status as string)
                ? "muted"
                : "brand"
          }
        >
          {app.status as string}
        </Tag>
        {deadline && days !== null && !isClosed(app.status as string) ? (
          <Tag tone={days >= 0 && days <= 3 ? "danger" : "brand"}>
            {days < 0 ? "마감됨" : days === 0 ? "D-DAY" : `D-${days}`}
          </Tag>
        ) : null}
      </div>

      {/* ---------------- 탭 ---------------- */}
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar md:mx-0 md:px-0">
        <div className="flex w-max gap-2">
          {TABS.map((item) => (
            <Link
              key={item.value}
              href={`/applications/${id}?tab=${item.value}`}
              aria-current={tab === item.value ? "page" : undefined}
              className={
                "inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium " +
                (tab === item.value
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-line bg-surface text-ink-700 hover:bg-muted-100")
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {tab === "posting" ? (
        <Card>
          <CardHeader title="공고·일정" />
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">마감</dt>
              <dd className="text-right">
                {deadline ? formatDeadline(deadline) : "없음"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">시즌</dt>
              <dd className="text-right">{(app.season as string) ?? "—"}</dd>
            </div>
            {app.posting_url ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">공고</dt>
                <dd className="text-right">
                  <a
                    href={app.posting_url as string}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
                  >
                    열기
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>

          {app.memo ? (
            <p className="mt-3 border-t border-line pt-3 wrap-anywhere whitespace-pre-wrap text-sm text-ink-700">
              {app.memo as string}
            </p>
          ) : null}

          {isMine ? (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-sm font-medium text-ink-700">첨부</p>
              <AttachmentPanel
                ownerKind="application"
                ownerId={id}
                items={attachments}
                userId={userId}
              />
            </div>
          ) : null}

          {app.posting_text ? (
            <details className="mt-3 border-t border-line pt-3">
              <summary className="cursor-pointer py-1 text-sm font-medium text-brand-600">
                붙여넣은 공고 원문 보기
              </summary>
              <p className="mt-2 wrap-anywhere whitespace-pre-wrap text-sm text-ink-500">
                {app.posting_text as string}
              </p>
            </details>
          ) : null}
        </Card>
      ) : null}

      {tab === "essays" ? (
        <Card>
          <CardHeader
            title="자소서"
            count={essays.length}
            moreHref="/library"
            moreLabel="라이브러리"
          />
          {essays.length === 0 ? (
            <EmptyState
              text="이 기업에 연결된 자소서가 없습니다."
              href="/library"
              cta="자소서 추가하러 가기"
            />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {essays.map((row) => {
                const essay = row as Record<string, unknown>;
                const answer = (essay.answer as string | null) ?? "";
                const limit = essay.char_limit as number | null;
                const over = limit ? answer.length > limit : false;
                return (
                  <li key={essay.id as string} className="py-3">
                    <p className="wrap-anywhere whitespace-pre-wrap text-sm font-medium">
                      {essay.question as string}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                      {essay.category ? <Tag>{essay.category as string}</Tag> : null}
                      <Tag tone={essay.is_final ? "success" : "muted"}>
                        {essay.is_final ? "최종" : "초안"}
                      </Tag>
                      <span className={over ? "font-medium text-danger-600" : ""}>
                        {answer.length}자{limit ? ` / ${limit}자` : ""}
                        {over ? " 초과" : ""}
                      </span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "interviews" ? (
        <Card>
          <CardHeader
            title="면접 복기"
            count={interviews.length}
            moreHref="/interviews"
            moreLabel="전체"
          />
          {interviews.length === 0 ? (
            <EmptyState
              text="이 기업의 면접 기록이 없습니다."
              href="/interviews"
              cta="면접 회차 만들기"
            />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {interviews.map((row) => {
                const iv = row as Record<string, unknown>;
                return (
                  <li key={iv.id as string} className="py-3">
                    <Link
                      href={`/interviews/${iv.id as string}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {iv.stage as string}
                          {iv.type ? ` · ${iv.type as string}` : ""}
                        </span>
                        <span className="block text-xs text-ink-400">
                          {(iv.date as string | null) ?? "날짜 없음"}
                        </span>
                      </span>
                      <Tag tone={resultTone(iv.result as string)}>
                        {iv.result as string}
                      </Tag>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "company" ? (
        <CompanyPanel companyName={app.company as string} />
      ) : null}
    </PageShell>
  );
}

/** 기업분석. DART 공개 자료를 하루 한 번만 받아 캐시해 보여 준다. */
async function CompanyPanel({ companyName }: { companyName: string }) {
  if (!process.env.DART_API_KEY) {
    return (
      <Card>
        <CardHeader title="기업분석" />
        <EmptyState text="DART 키가 설정되지 않았습니다. 운영자에게 알려 주세요." />
      </Card>
    );
  }

  const supabase = await createClient();

  // 이름이 정확히 같은 곳을 먼저 찾고, 없으면 부분 일치로 찾는다.
  // "(주)" 같은 앞뒤 표기를 떼고 비교한다.
  const cleaned = companyName.replace(/\((주|유|재)\)|주식회사/g, "").trim();

  const { data: exact } = await supabase
    .from("dart_corps")
    .select("corp_code, corp_name, stock_code")
    .eq("corp_name", cleaned)
    .limit(1)
    .maybeSingle();

  let corp = exact;
  if (!corp) {
    const { data: like } = await supabase
      .from("dart_corps")
      .select("corp_code, corp_name, stock_code")
      .ilike("corp_name", `%${cleaned}%`)
      .limit(1)
      .maybeSingle();
    corp = like;
  }

  if (!corp) {
    return (
      <Card>
        <CardHeader title="기업분석" />
        <EmptyState
          text={`"${companyName}" 과 맞는 상장사를 DART 목록에서 찾지 못했습니다. 비상장 기업이거나 이름이 조금 다를 수 있습니다.`}
        />
      </Card>
    );
  }

  let report;
  try {
    report = await loadCompanyReport(corp.corp_code as string);
  } catch (error) {
    return (
      <Card>
        <CardHeader title="기업분석" />
        <EmptyState
          text={
            error instanceof DartError
              ? error.message
              : "기업 정보를 받지 못했습니다."
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="기업개황" />
        <p className="mb-3 text-xs text-ink-400">
          DART 기준 · {corp.corp_name as string}
          {corp.stock_code ? ` (${corp.stock_code as string})` : ""}
        </p>
        {report.brief ? (
          <dl className="flex flex-col gap-2 text-sm">
            {[
              ["대표자", report.brief.ceoName],
              ["설립일", report.brief.establishDate],
              ["주소", report.brief.address],
            ]
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-ink-500">{label as string}</dt>
                  <dd className="text-right wrap-anywhere">{value as string}</dd>
                </div>
              ))}
            {report.brief.homepage ? (
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-ink-500">홈페이지</dt>
                <dd className="text-right">
                  <a
                    href={
                      report.brief.homepage.startsWith("http")
                        ? report.brief.homepage
                        : `https://${report.brief.homepage}`
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-brand-600 hover:underline"
                  >
                    열기
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-ink-400">기업개황 자료가 없습니다.</p>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`재무${report.financeYear ? ` (${report.financeYear}년 사업보고서)` : ""}`}
        />
        {report.finances.length === 0 ? (
          <p className="text-sm text-ink-400">재무 자료를 찾지 못했습니다.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-2">
            {report.finances.map((row) => (
              <div
                key={row.label}
                className="rounded-lg border border-line p-2.5"
              >
                <dt className="text-xs text-ink-500">{row.label}</dt>
                <dd className="mt-0.5 text-sm font-bold">{row.amount}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card>
        <CardHeader title="최근 공시" count={report.disclosures.length} />
        {report.disclosures.length === 0 ? (
          <p className="text-sm text-ink-400">최근 6개월 공시가 없습니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {report.disclosures.map((row) => (
              <li key={row.receiptNo} className="py-2.5">
                <a
                  href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${row.receiptNo}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-start justify-between gap-3"
                >
                  <span className="min-w-0 wrap-anywhere text-sm text-ink-700">
                    {row.title}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">
                    {row.date}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {report.notes.length > 0 ? (
        <p className="text-xs text-ink-400">{report.notes.join(" · ")}</p>
      ) : null}

      <p className="text-center text-xs text-ink-400">
        자료 출처: 금융감독원 전자공시시스템(DART) · 하루 한 번 받아 둡니다
      </p>
    </div>
  );
}
