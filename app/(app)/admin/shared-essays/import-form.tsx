"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, FileText, Trash2, Upload } from "lucide-react";

import { saveSharedEssays } from "./actions";
import {
  SHARED_RESULTS,
  VISIBILITIES,
  countChars,
  findSensitive,
  splitQuestions,
  type ParsedEssay,
} from "@/lib/shared-essay";
import { ESSAY_CATEGORIES } from "@/lib/essay-category";
import {
  Card,
  CardHeader,
  btnGhost,
  btnPrimary,
  inputClass,
  labelClass,
} from "@/components/ui/primitives";

/** 파일 이름에서 기업 이름을 넘겨짚어 본다. 틀리면 사람이 고친다. */
function guessCompany(fileName: string): string {
  return fileName
    .replace(/\.(md|txt|markdown)$/i, "")
    .replace(/[_-]+/g, " ")
    .split(/\s+/)[0]
    .slice(0, 30);
}

export function SharedEssayImportForm() {
  const [state, action, pending] = useActionState(saveSharedEssays, null);

  const [items, setItems] = useState<ParsedEssay[]>([]);
  const [company, setCompany] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [visibility, setVisibility] = useState("admin");
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /** 본문에 연락처처럼 보이는 것이 있는지 */
  const sensitive = useMemo(() => {
    const joined = items
      .map((item) => `${item.question}\n${item.answer}`)
      .join("\n");
    return findSensitive(joined);
  }, [items]);

  function addParsed(parsed: ParsedEssay[], source: string) {
    if (parsed.length === 0) {
      setNote(`${source}: 문항을 찾지 못했습니다.`);
      return;
    }
    setItems((prev) => [...prev, ...parsed]);
    setAcknowledged(false);
    setNote(`${source}: 문항 ${parsed.length}개를 불러왔습니다.`);
  }

  function handlePaste(formValue: string) {
    addParsed(splitQuestions(formValue), "붙여넣기");
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const collected: ParsedEssay[] = [];
    let firstName = "";

    for (const file of Array.from(fileList)) {
      if (!/\.(md|txt|markdown)$/i.test(file.name)) {
        setNote(`${file.name}: .md 와 .txt 만 읽을 수 있습니다.`);
        continue;
      }
      const raw = await file.text();
      collected.push(...splitQuestions(raw));
      if (!firstName) firstName = file.name;
    }

    if (collected.length > 0 && !company && firstName) {
      setCompany(guessCompany(firstName));
    }
    addParsed(collected, `파일 ${fileList.length}개`);
  }

  function updateItem(index: number, patch: Partial<ParsedEssay>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    setAcknowledged(false);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const blocked = sensitive.length > 0 && !acknowledged;
  const ready = items.length > 0 && company.trim().length > 0 && !blocked;

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* ---------------- 불러오기 ---------------- */}
      <Card>
        <CardHeader title="1. 불러오기" />

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>붙여넣기</span>
          <textarea
            rows={6}
            placeholder={
              "받은 자소서를 통째로 붙여넣으세요.\n\n1. 지원 동기를 기술하시오 (500자)\n저는 ...\n\n2. 직무 역량을 ...\n대학에서 ..."
            }
            className={inputClass + " font-mono text-sm"}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (!value) return;
              handlePaste(value);
              e.target.value = "";
            }}
          />
          <span className="text-xs text-ink-400">
            칸 밖을 누르면 문항별로 나눠 아래에 담습니다. 여러 번 붙여넣어도 됩니다.
          </span>
        </label>

        <div className="mt-3 border-t border-line pt-3">
          <span className={labelClass}>파일로 올리기</span>
          <label className={btnGhost + " mt-1.5 w-full cursor-pointer sm:w-auto"}>
            <Upload className="size-4" aria-hidden />
            .md · .txt 고르기 (여러 개 가능)
            <input
              type="file"
              accept=".md,.txt,.markdown,text/plain,text/markdown"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-1.5 text-xs text-ink-400">
            파일은 브라우저에서만 읽습니다. 서버로 파일 자체를 올리지 않습니다.
          </p>
        </div>

        {note ? (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            {note}
          </p>
        ) : null}
      </Card>

      {/* ---------------- 공통 정보 ---------------- */}
      <Card>
        <CardHeader title="2. 공통 정보" />
        <p className="mb-3 text-sm text-ink-500">
          아래에 담긴 문항 전부에 같이 붙습니다.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>기업 *</span>
            <input
              name="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="삼성전자"
              className={inputClass + " h-11"}
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>직무</span>
            <input
              name="role"
              placeholder="경영지원"
              className={inputClass + " h-11"}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>시즌</span>
            <input
              name="season"
              placeholder="2026 상반기"
              className={inputClass + " h-11"}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>결과</span>
            <select name="result" className={inputClass + " h-11"} defaultValue="모름">
              {SHARED_RESULTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className={labelClass}>출처 메모 (운영자만 보임)</span>
          <input
            name="source_memo"
            placeholder="2026-09 동아리 선배에게 받음"
            className={inputClass + " h-11"}
          />
          <span className="text-xs text-ink-400">
            사용자 화면에는 나오지 않습니다. 작성자 이름·학교·연락처는 적지 마세요.
          </span>
        </label>
      </Card>

      {/* ---------------- 공개 범위 ---------------- */}
      <Card>
        <CardHeader title="3. 공개 범위" />

        <div className="flex flex-col gap-2">
          {VISIBILITIES.map((item) => (
            <label
              key={item.value}
              className="flex items-center gap-3 rounded-lg border border-line px-3 py-3"
            >
              <input
                type="radio"
                name="visibility"
                value={item.value}
                checked={visibility === item.value}
                onChange={() => setVisibility(item.value)}
                className="size-5 shrink-0 accent-brand-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block text-xs text-ink-500">
                  {item.value === "admin"
                    ? "이 화면에서만 보입니다. 사용자는 볼 수 없습니다."
                    : "라이브러리의 공용 자소서 탭에서 모든 사용자가 읽습니다."}
                </span>
              </span>
            </label>
          ))}
        </div>

        <label className="mt-3 flex items-start gap-3 border-t border-line pt-3">
          <input
            type="checkbox"
            name="consent_confirmed"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-brand-600"
          />
          <span className="min-w-0 text-sm">
            <span className="block font-medium">작성자에게 공개 동의를 받았습니다.</span>
            <span className="block text-xs text-ink-500">
              체크하지 않으면 전체 공개로 저장할 수 없습니다.
            </span>
          </span>
        </label>

        {visibility === "all" && !consent ? (
          <p className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
            전체 공개를 고르셨습니다. 동의 확인에 체크해 주세요.
          </p>
        ) : null}
      </Card>

      {/* ---------------- 미리보기 ---------------- */}
      <Card>
        <CardHeader title="4. 미리보기" count={items.length} />

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-500">
            위에서 붙여넣거나 파일을 올리면 여기에 문항이 나눠져 담깁니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => (
              <li
                key={index}
                className="rounded-lg border border-line p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                    <FileText className="size-3.5" aria-hidden />
                    문항 {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-danger-700 hover:bg-danger-50"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    빼기
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={item.question}
                  onChange={(e) => updateItem(index, { question: e.target.value })}
                  placeholder="문항을 적어 주세요"
                  className={inputClass + " text-sm"}
                />

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    value={item.category ?? ""}
                    onChange={(e) =>
                      updateItem(index, { category: e.target.value || null })
                    }
                    className={inputClass + " h-11"}
                    aria-label="문항 유형"
                  >
                    <option value="">유형 선택 안 함</option>
                    {ESSAY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={item.charLimit ?? ""}
                    onChange={(e) =>
                      updateItem(index, {
                        charLimit: e.target.value
                          ? Number.parseInt(e.target.value, 10)
                          : null,
                      })
                    }
                    placeholder="글자 수 제한"
                    className={inputClass + " h-11"}
                    aria-label="글자 수 제한"
                  />
                </div>

                <textarea
                  rows={5}
                  value={item.answer}
                  onChange={(e) => updateItem(index, { answer: e.target.value })}
                  className={inputClass + " mt-2 text-sm"}
                />
                <p className="mt-1 text-xs text-ink-400">
                  공백 포함 {countChars(item.answer).toLocaleString()}자
                  {item.charLimit
                    ? ` / 제한 ${item.charLimit.toLocaleString()}자`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------------- 경고 + 저장 ---------------- */}
      {sensitive.length > 0 ? (
        <div className="rounded-lg border border-danger-100 bg-danger-50 p-4">
          <p className="flex items-center gap-2 font-bold text-danger-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            본문에서 개인정보처럼 보이는 것을 찾았습니다
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-danger-700">
            {sensitive.map((hit, index) => (
              <li key={index}>
                · {hit.kind} — <code>{hit.sample}</code>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-danger-700">
            위 미리보기에서 해당 부분을 지운 뒤 저장해 주세요.
          </p>
          <label className="mt-3 flex items-center gap-2 border-t border-danger-100 pt-3 text-sm text-danger-700">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="size-5 shrink-0 accent-danger-600"
            />
            확인했습니다. 이대로 저장합니다.
          </label>
        </div>
      ) : null}

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

      {/* 화면에서 고친 내용을 그대로 서버로 넘긴다 */}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <button
        type="submit"
        disabled={pending || !ready}
        className={btnPrimary + " self-start"}
      >
        {pending ? "저장 중..." : `문항 ${items.length}개 저장`}
      </button>
    </form>
  );
}
