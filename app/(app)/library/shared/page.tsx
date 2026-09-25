import { Info } from "lucide-react";

import { SharedEssayCard } from "./essay-card";
import { LibraryTabs } from "@/components/library-tabs";
import { PageShell } from "@/components/page-shell";
import {
  Card,
  EmptyState,
  btnGhost,
  btnPrimary,
  inputClass,
} from "@/components/ui/primitives";
import { ESSAY_CATEGORIES } from "@/lib/essay-category";
import { SHARED_RESULTS, type SharedEssay } from "@/lib/shared-essay";
import { createClient } from "@/lib/supabase/server";

/**
 * 공용 자소서 (읽기 전용).
 *
 * RLS 가 "전체 공개" 인 것만 내려보낸다. 여기서는 따로 거르지 않아도 되지만,
 * 정책이 바뀌어도 새지 않도록 조건을 한 번 더 건다.
 * 출처 메모는 운영자 전용이라 아예 select 하지 않는다.
 */
/** PostgREST 의 or 필터가 깨지지 않게 특수문자를 걸러낸다. */
function safeKeyword(raw: string): string {
  return raw.replace(/[,()*\\]/g, " ").trim().slice(0, 50);
}

export default async function SharedLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    company?: string;
    role?: string;
    category?: string;
    result?: string;
  }>;
}) {
  const params = await searchParams;
  const keyword = safeKeyword(params.q ?? "");
  const company = params.company ?? "";
  const role = params.role ?? "";
  const category = params.category ?? "";
  const result = params.result ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("shared_essays")
    .select(
      "id, company, role, season, question, char_limit, answer, category, result",
    )
    .eq("visibility", "all")
    .order("created_at", { ascending: false });

  if (keyword) {
    query = query.or(
      `question.ilike.%${keyword}%,answer.ilike.%${keyword}%,company.ilike.%${keyword}%`,
    );
  }
  if (company) query = query.eq("company", company);
  if (role) query = query.eq("role", role);
  if (category) query = query.eq("category", category);
  if (result) query = query.eq("result", result);

  // 필터 목록은 전체에서 뽑는다. 걸러진 결과만 보면 선택지가 사라진다.
  const [listResult, allResult] = await Promise.all([
    query,
    supabase
      .from("shared_essays")
      .select("company, role")
      .eq("visibility", "all"),
  ]);

  const essays = (listResult.data ?? []) as SharedEssay[];
  const all = (allResult.data ?? []) as { company: string; role: string | null }[];

  const companies = [...new Set(all.map((e) => e.company))].sort();
  const roles = [...new Set(all.map((e) => e.role).filter(Boolean))].sort() as string[];

  const filtering = Boolean(keyword || company || role || category || result);

  return (
    <PageShell
      title="라이브러리"
      description="다른 사람이 공유해 준 자소서를 참고합니다."
    >
      <LibraryTabs />

      {/* ---------------- 안내 ---------------- */}
      <div className="flex gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong>참고용입니다.</strong> 문장을 그대로 쓰면 표절 검사에 걸릴 수
          있어요. 구성과 흐름만 참고하고, 내용은 본인 경험으로 채우세요.
        </span>
      </div>

      {/* ---------------- 검색 ---------------- */}
      <Card>
        <form method="get" className="flex flex-col gap-2">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="기업·문항·답변에서 검색"
            className={inputClass + " h-11"}
          />

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <select
              name="company"
              defaultValue={company}
              className={inputClass + " h-11"}
              aria-label="기업"
            >
              <option value="">기업 전체</option>
              {companies.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              name="role"
              defaultValue={role}
              className={inputClass + " h-11"}
              aria-label="직무"
            >
              <option value="">직무 전체</option>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              name="category"
              defaultValue={category}
              className={inputClass + " h-11"}
              aria-label="문항 유형"
            >
              <option value="">유형 전체</option>
              {ESSAY_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              name="result"
              defaultValue={result}
              className={inputClass + " h-11"}
              aria-label="결과"
            >
              <option value="">결과 전체</option>
              {SHARED_RESULTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button type="submit" className={btnPrimary}>
              검색
            </button>
            {filtering ? (
              <a href="/library/shared" className={btnGhost}>
                조건 지우기
              </a>
            ) : null}
          </div>
        </form>
      </Card>

      {/* ---------------- 목록 ---------------- */}
      <p className="text-sm text-ink-500">
        {filtering ? "조건에 맞는 " : ""}
        공용 자소서 <strong className="text-ink-900">{essays.length}</strong>개
      </p>

      {essays.length === 0 ? (
        <EmptyState
          center
          text={
            filtering
              ? "조건에 맞는 자소서가 없습니다. 조건을 줄여 보세요."
              : "아직 공개된 공용 자소서가 없습니다."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {essays.map((essay) => (
            <SharedEssayCard key={essay.id} essay={essay} />
          ))}
        </ul>
      )}
    </PageShell>
  );
}
