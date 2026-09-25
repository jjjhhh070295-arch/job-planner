"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  Paperclip,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";

import {
  createFileAttachment,
  createLinkAttachment,
  getAttachmentUrl,
  removeAttachment,
} from "@/app/(app)/attachments/actions";
import { FormSheet } from "@/components/ui/form-sheet";
import { btnGhost, btnIcon, btnPrimary, inputClass } from "@/components/ui/primitives";
import {
  ATTACHMENT_BUCKET,
  MAX_ATTACHMENT_BYTES,
  formatBytes,
  type AttachmentRow,
} from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";

const MAX_EDGE = 1600;
const QUALITY = 0.8;

/**
 * 이미지는 올리기 전에 줄인다.
 * 요즘 폰 사진은 한 장에 4~8MB 라 10MB 제한에 금방 걸린다.
 * 증명서 글자를 읽을 정도는 넉넉히 남는다. PDF 는 그대로 올린다.
 */
async function compressImage(file: File): Promise<Blob> {
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

function AttachmentItem({ item }: { item: AttachmentRow }) {
  const [opening, setOpening] = useState(false);

  const Icon =
    item.kind === "link"
      ? Link2
      : item.mime_type === "application/pdf"
        ? FileText
        : ImageIcon;

  return (
    <li className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
      <Icon className="size-4 shrink-0 text-ink-400" aria-hidden />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{item.label}</span>
        {item.kind === "file" && item.size_bytes ? (
          <span className="block text-xs text-ink-400">
            {formatBytes(item.size_bytes)}
          </span>
        ) : null}
      </span>

      {item.kind === "link" ? (
        <a
          href={item.url ?? "#"}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 px-2 py-2 text-xs font-medium text-brand-600 hover:underline"
        >
          열기
        </a>
      ) : (
        <button
          type="button"
          disabled={opening}
          onClick={async () => {
            setOpening(true);
            // 주소를 화면에 박아 두지 않고, 누를 때마다 새로 받아 연다.
            const url = await getAttachmentUrl(item.id);
            setOpening(false);
            if (url) {
              window.open(url, "_blank", "noopener,noreferrer");
            } else {
              window.alert("파일을 열지 못했습니다.");
            }
          }}
          className="shrink-0 px-2 py-2 text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
        >
          {opening ? "여는 중..." : "열기"}
        </button>
      )}

      <form
        action={removeAttachment}
        onSubmit={(event) => {
          if (!window.confirm(`"${item.label}" 을(를) 지울까요?`)) {
            event.preventDefault();
          }
        }}
        className="shrink-0"
      >
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          aria-label={`${item.label} 삭제`}
          className={btnIcon + " hover:bg-danger-50 hover:text-danger-600"}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </form>
    </li>
  );
}

export function AttachmentPanel({
  ownerKind,
  ownerId,
  items,
  userId,
}: {
  ownerKind: "spec" | "experience" | "application";
  ownerId: string;
  items: AttachmentRow[];
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileState, fileAction] = useActionState(createFileAttachment, null);
  const [linkState, linkAction, linkPending] = useActionState(
    createLinkAttachment,
    null,
  );

  // 숨은 폼으로 서버 액션을 부르기 위한 값들
  const [pending, setPending] = useState<{
    label: string;
    path: string;
    mime: string;
    size: number;
  } | null>(null);
  const hiddenFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (pending) hiddenFormRef.current?.requestSubmit();
  }, [pending]);

  useEffect(() => {
    if (fileState?.ok || linkState?.ok) {
      setPending(null);
      setOpen(false);
    }
  }, [fileState, linkState]);

  async function handleFile(file: File) {
    setError(null);

    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("PDF 와 이미지만 올릴 수 있습니다.");
      return;
    }

    try {
      setBusy(isImage ? "이미지 줄이는 중..." : "준비 중...");
      const blob = isImage ? await compressImage(file) : file;
      const mime = isImage ? "image/jpeg" : "application/pdf";

      if (blob.size > MAX_ATTACHMENT_BYTES) {
        setError(
          `줄인 뒤에도 ${formatBytes(blob.size)} 입니다. 10MB 이하로 만들어 주세요.`,
        );
        setBusy(null);
        return;
      }

      setBusy("올리는 중...");
      const ext = isImage ? "jpg" : "pdf";
      // 경로 첫 칸이 내 user_id 여야 Storage 정책을 통과한다.
      const path = `${userId}/${Date.now()}.${ext}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, blob, { contentType: mime, upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      setPending({
        label: file.name.slice(0, 100),
        path,
        mime,
        size: blob.size,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "올리지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3">
      {items.length > 0 ? (
        <ul className="mb-2 flex flex-col gap-1.5">
          {items.map((item) => (
            <AttachmentItem key={item.id} item={item} />
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={btnGhost + " h-9 px-3 text-xs"}
      >
        <Paperclip className="size-3.5" aria-hidden />
        첨부 {items.length > 0 ? `(${items.length})` : "추가"}
      </button>

      <FormSheet open={open} onClose={() => setOpen(false)} title="첨부 추가">
        <div className="flex flex-col gap-4">
          <p className="flex gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>주민번호 등 민감정보는 가리고 올려주세요.</strong>{" "}
              주민등록번호, 주소, 연락처가 보이는 부분은 지우거나 검게 칠한 뒤
              올리시는 것이 안전합니다.
            </span>
          </p>

          <p className="text-xs text-ink-500">
            첨부는 <strong>공유해도 상대에게 보이지 않습니다.</strong> 비공개
            보관함에 들어가고, 볼 때마다 1분짜리 임시 링크를 새로 만듭니다.
          </p>

          {/* ---------------- 파일 올리기 ---------------- */}
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">파일 올리기</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
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
              <Upload className="size-4" aria-hidden />
              {busy ?? "PDF·이미지 고르기"}
            </button>
            <p className="mt-1 text-xs text-ink-400">
              10MB 이하. 이미지는 올리기 전에 자동으로 줄입니다.
            </p>

            {/* 올린 뒤 서버에 기록하는 숨은 폼 */}
            <form ref={hiddenFormRef} action={fileAction} className="hidden">
              <input type="hidden" name="owner_kind" value={ownerKind} />
              <input type="hidden" name="owner_id" value={ownerId} />
              <input type="hidden" name="label" value={pending?.label ?? ""} />
              <input
                type="hidden"
                name="storage_path"
                value={pending?.path ?? ""}
              />
              <input type="hidden" name="mime_type" value={pending?.mime ?? ""} />
              <input
                type="hidden"
                name="size_bytes"
                value={pending?.size ?? ""}
              />
            </form>
          </div>

          {/* ---------------- 링크만 저장 ---------------- */}
          <form action={linkAction} className="border-t border-line pt-4">
            <input type="hidden" name="owner_kind" value={ownerKind} />
            <input type="hidden" name="owner_id" value={ownerId} />

            <p className="mb-2 text-sm font-medium text-ink-700">
              또는 링크만 저장
            </p>
            <p className="mb-2 text-xs text-ink-400">
              구글 드라이브 같은 곳에 올려 두고 링크만 적어 두는 방법입니다.
              파일이 이 앱에 저장되지 않습니다.
            </p>

            <div className="flex flex-col gap-2">
              <input
                name="label"
                required
                placeholder="이름 (예: 토익 성적표)"
                className={inputClass + " h-11"}
              />
              <input
                name="url"
                type="url"
                required
                placeholder="https://drive.google.com/..."
                className={inputClass + " h-11"}
              />
            </div>

            <button
              type="submit"
              disabled={linkPending}
              className={btnGhost + " mt-3 w-full"}
            >
              <ExternalLink className="size-4" aria-hidden />
              {linkPending ? "저장 중..." : "링크 저장"}
            </button>
          </form>

          {error || fileState?.message || linkState?.message ? (
            <p
              className={
                "rounded-lg px-3 py-2 text-sm " +
                (fileState?.ok || linkState?.ok
                  ? "bg-success-50 text-success-700"
                  : "bg-danger-50 text-danger-700")
              }
            >
              {error ?? fileState?.message ?? linkState?.message}
            </p>
          ) : null}
        </div>
      </FormSheet>
    </div>
  );
}
