"use client";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "textarea" | "select" | "number";
  options?: string[];
  /** options 대신 값과 표시 이름이 다를 때 쓴다 (예: 기업 선택) */
  choices?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** 두 칸을 모두 차지할지 */
  wide?: boolean;
};

export const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500";

/**
 * 추가 폼과 수정 폼이 같은 입력 칸을 쓴다.
 * defaults 를 주면 그 값이 미리 채워진다 (수정 폼).
 */
export function FormFields({
  fields,
  defaults,
}: {
  fields: Field[];
  defaults?: Record<string, string | null | undefined>;
}) {
  const initial = (name: string) => defaults?.[name] ?? undefined;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <label
          key={field.name}
          className={
            "flex flex-col gap-1.5 " +
            (field.wide || field.type === "textarea" ? "sm:col-span-2" : "")
          }
        >
          <span className="text-xs font-medium text-gray-700">
            {field.label}
            {field.required ? <span className="text-red-500"> *</span> : null}
          </span>

          {field.type === "textarea" ? (
            <textarea
              name={field.name}
              rows={3}
              required={field.required}
              placeholder={field.placeholder}
              defaultValue={initial(field.name) ?? ""}
              className={inputClass}
            />
          ) : field.type === "select" ? (
            <select
              name={field.name}
              defaultValue={
                initial(field.name) ??
                field.choices?.[0]?.value ??
                field.options?.[0]
              }
              className={inputClass}
            >
              {field.choices
                ? field.choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))
                : field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
            </select>
          ) : (
            <input
              type={
                field.type === "date"
                  ? "date"
                  : field.type === "number"
                    ? "number"
                    : "text"
              }
              name={field.name}
              required={field.required}
              placeholder={field.placeholder}
              defaultValue={initial(field.name) ?? ""}
              className={inputClass}
            />
          )}

          {field.hint ? (
            <span className="text-xs text-gray-400">{field.hint}</span>
          ) : null}
        </label>
      ))}
    </div>
  );
}
