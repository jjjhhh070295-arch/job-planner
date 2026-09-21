"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImageUp, Sparkles } from "lucide-react";

import { saveCaptureSession } from "./actions";
import { FormSheet } from "@/components/ui/form-sheet";
import { btnGhost, btnPrimary, inputClass } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "study-captures";
const MAX_EDGE = 1280;
const QUALITY = 0.7;

/**
 * 브라우저에서 이미지를 줄여서 올린다.
 * 요즘 폰 사진은 한 장에 4~8MB 라 그대로 올리면 느리고 저장 공간도 금방 찬다.
 * 글자를 읽을 정도만 남기면 200KB 안쪽으로 줄어든다.
 */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 줄이지 못했습니다.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("이미지를 줄이지 못했습니다.")),
      "image/jpeg",
      QUALITY,
    );
  });
}

type Parsed = {
  subject: string | null;
  date: string | null;
  minutes: number | null;
  raw_text: string | null;
  confident: boolean;
};

export function CaptureUpload({
  userId,
  milestones,
}: {
  userId: string;
  milestones: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [path, setPath] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState(saveCaptureSession, null);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setParsed(null);
      setPath("");
      setPreview(null);
    }
  }, [state]);

  // 미리보기용 URL 은 다 쓰면 반납한다.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(file: File) {
    setError(null);
    setParsed(null);

    try {
      setBusy("이미지 줄이는 중...");
      const blob = await compress(file);
      setPreview(URL.createObjectURL(blob));

      setBusy("올리는 중...");
      // 경로 첫 칸이 내 user_id 여야 Storage 정책을 통과한다.
      const objectPath = `${userId}/${Date.now()}.jpg`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, blob, { contentType: "image/jpeg", upsert: false });

      if (uploadError) throw new Error(uploadError.message);
      setPath(objectPath);

      setBusy("AI가 읽는 중...");
      const response = await fetch("/api/ai/parse-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: objectPath }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "캡처를 읽지 못했습니다.");
        return;
      }
      setParsed(data.parsed as Parsed);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "이미지를 처리하지 못했습니다.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={btnGhost + " w-full border-dashed"}
      >
        <ImageUp className="size-4" aria-hidden />
        캡처 올려서 자동 입력
      </button>

      <FormSheet
        open={open}
        onClose={() => setOpen(false)}
        title="캡처로 공부 시간 넣기"
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
            열품타 같은 앱의 화면을 캡처해서 올리면 날짜와 시간을 읽어 드립니다.
            <strong> 읽은 값을 확인하고 고친 뒤에 저장</strong>됩니다.
          </p>

          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
              className={btnPrimary + " w-full"}
            >
              <Sparkles className="size-4" aria-hidden />
              {busy ?? "캡처 고르기"}
            </button>
          </div>

          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="올린 캡처 미리보기"
              className="max-h-48 w-full rounded-lg border border-line object-contain"
            />
          ) : null}

          {error ? (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {error}
            </p>
          ) : null}

          {parsed ? (
            <form action={action} className="flex flex-col gap-3">
              <input type="hidden" name="capture_path" value={path} />

              {!parsed.confident ? (
                <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                  숫자를 또렷하게 읽지 못했습니다. 값을 꼭 확인해 주세요.
                </p>
              ) : null}

              {parsed.raw_text ? (
                <p className="rounded-lg bg-muted-100 px-3 py-2 text-xs text-muted-600">
                  읽은 글자: {parsed.raw_text}
                </p>
              ) : null}

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-700">과목</span>
                <input
                  name="subject"
                  required
                  defaultValue={parsed.subject ?? ""}
                  placeholder="인적성"
                  className={inputClass + " h-11"}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-700">날짜</span>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={parsed.date ?? ""}
                  className={inputClass + " h-11"}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink-700">
                  공부한 시간 (분)
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  name="minutes"
                  required
                  defaultValue={parsed.minutes ?? ""}
                  className={inputClass + " h-11"}
                />
              </label>

              {milestones.length > 0 ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-700">
                    연결할 마일스톤
                  </span>
                  <select
                    name="milestone_id"
                    defaultValue=""
                    className={inputClass + " h-11"}
                  >
                    <option value="">연결 안 함</option>
                    {milestones.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {state && !state.ok ? (
                <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                  {state.message}
                </p>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className={btnPrimary + " flex-1 md:flex-none"}
                >
                  {pending ? "저장 중..." : "확인하고 저장"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={btnGhost}
                >
                  닫기
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </FormSheet>
    </>
  );
}
