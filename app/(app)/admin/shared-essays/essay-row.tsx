"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Eye, EyeOff, Pencil } from "lucide-react";

import { updateSharedEssay } from "./actions";
import { DeleteRowButton } from "@/components/delete-row-button";
import { removeSharedEssay } from "./actions";
import { ESSAY_CATEGORIES } from "@/lib/essay-category";
import { SHARED_RESULTS, VISIBILITIES, countChars } from "@/lib/shared-essay";
import {
  Tag,
  btnGhost,
  btnPrimary,
  inputClass,
  labelClass,
} from "@/components/ui/primitives";

export type SharedEssayRow = {
  id: string;
  company: string;
  role: string | null;
  season: string | null;
  question: string;
  char_limit: number | null;
  answer: string;
  category: string | null;
  result: string;
  source_memo: string | null;
  consent_confirmed: boolean;
  visibility: string;
};

export function AdminSharedEssayRow({ essay }: { essay: SharedEssayRow }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateSharedEssay, null);
  const [visibility, setVisibility] = useState(essay.visibility);
  const [consent, setConsent] = useState(essay.consent_confirmed);

  const isPublic = essay.visibility === "all";

  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      {/* ---------------- 접힌 상태 ---------------- */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold">{essay.company}</span>
            {essay.role ? (
              <span className="text-xs text-ink-500">{essay.role}</span>
            ) : null}
            {essay.season ? (
              <span className="text-xs text-ink-400">{essay.season}</span>
            ) : null}
          </span>
          <span className="mt-1 block truncate text-sm text-ink-700">
            {essay.question}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Tag tone={isPublic ? "success" : "muted"}>
              {isPublic ? "전체 공개" : "운영자만"}
            </Tag>
            {essay.category ? <Tag tone="brand">{essay.category}</Tag> : null}
            <Tag
              tone={
                essay.result === "최종 합격"
                  ? "success"
                  : essay.result === "불합격"
                    ? "muted"
                    : "brand"
              }
            >
              {essay.result}
            </Tag>
            <span className="text-[11px] text-ink-400">
              {countChars(essay.answer).toLocaleString()}자
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <span
            className="inline-flex size-8 items-center justify-center text-ink-400"
            title={isPublic ? "사용자에게 보임" : "사용자에게 안 보임"}
          >
            {isPublic ? (
              <Eye className="size-4" aria-hidden />
            ) : (
              <EyeOff className="size-4" aria-hidden />
            )}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "접기" : "펼치기"}
            className="inline-flex size-8 items-center justify-center rounded-md text-ink-400 hover:bg-header"
          >
            <ChevronDown
              className={"size-4 transition-transform " + (open ? "rotate-180" : "")}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* ---------------- 펼친 상태 ---------------- */}
      {open ? (
        <div className="mt-3 border-t border-line pt-3">
          {editing ? (
            <form action={action} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={essay.id} />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>기업 *</span>
                  <input
                    name="company"
                    defaultValue={essay.company}
                    className={inputClass + " h-11"}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>직무</span>
                  <input
                    name="role"
                    defaultValue={essay.role ?? ""}
                    className={inputClass + " h-11"}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>시즌</span>
                  <input
                    name="season"
                    defaultValue={essay.season ?? ""}
                    className={inputClass + " h-11"}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>문항 *</span>
                <textarea
                  name="question"
                  rows={2}
                  defaultValue={essay.question}
                  className={inputClass + " text-sm"}
                  required
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>문항 유형</span>
                  <select
                    name="category"
                    defaultValue={essay.category ?? ""}
                    className={inputClass + " h-11"}
                  >
                    <option value="">선택 안 함</option>
                    {ESSAY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>글자 수 제한</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    name="char_limit"
                    defaultValue={essay.char_limit ?? ""}
                    className={inputClass + " h-11"}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>결과</span>
                  <select
                    name="result"
                    defaultValue={essay.result}
                    className={inputClass + " h-11"}
                  >
                    {SHARED_RESULTS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>답변 *</span>
                <textarea
                  name="answer"
                  rows={8}
                  defaultValue={essay.answer}
                  className={inputClass + " text-sm"}
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>출처 메모 (운영자만 보임)</span>
                <input
                  name="source_memo"
                  defaultValue={essay.source_memo ?? ""}
                  className={inputClass + " h-11"}
                />
              </label>

              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <span className={labelClass}>공개 범위</span>
                {VISIBILITIES.map((item) => (
                  <label key={item.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="visibility"
                      value={item.value}
                      checked={visibility === item.value}
                      onChange={() => setVisibility(item.value)}
                      className="size-5 shrink-0 accent-brand-600"
                    />
                    {item.label}
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="consent_confirmed"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="size-5 shrink-0 accent-brand-600"
                  />
                  작성자에게 공개 동의를 받았습니다.
                </label>
                {visibility === "all" && !consent ? (
                  <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                    전체 공개는 동의 확인에 체크해야 저장됩니다.
                  </p>
                ) : null}
              </div>

              {state ? (
                <p
                  className={
                    "rounded-lg px-3 py-2 text-sm " +
                    (state.ok
                      ? "bg-success-50 text-success-700"
                      : "bg-danger-50 text-danger-700")
                  }
                >
                  {state.message}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={btnPrimary}>
                  {pending ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className={btnGhost}
                >
                  취소
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="text-sm font-medium text-ink-700">{essay.question}</p>
              <p className="mt-2 text-sm whitespace-pre-wrap text-ink-700">
                {essay.answer}
              </p>
              {essay.source_memo ? (
                <p className="mt-3 rounded-lg bg-muted-100 px-3 py-2 text-xs text-muted-600">
                  출처 메모: {essay.source_memo}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className={btnGhost}
                >
                  <Pencil className="size-4" aria-hidden />
                  고치기
                </button>
                <DeleteRowButton
                  action={removeSharedEssay}
                  id={essay.id}
                  label={`${essay.company} · ${essay.question.slice(0, 20)}`}
                />
              </div>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
