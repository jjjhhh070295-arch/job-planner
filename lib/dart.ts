import "server-only";

import { inflateRawSync } from "node:zlib";

import { createAdminClient } from "@/lib/supabase/admin";
import { todayInSeoul } from "@/lib/date";

/* ============================================================
   DART 오픈API (CLAUDE.md 8장, 2차 기능).
   결과는 하루 한 번만 받아 캐시한다.
   ============================================================ */

const BASE = "https://opendart.fss.or.kr/api";
const TIMEOUT_MS = 20_000;

export class DartError extends Error {}

function apiKey(): string {
  const key = process.env.DART_API_KEY;
  if (!key) {
    throw new DartError("DART 키가 설정되지 않았습니다. 운영자에게 알려 주세요.");
  }
  return key;
}

/** DART 응답 코드 뜻 */
const STATUS_MESSAGE: Record<string, string> = {
  "000": "정상",
  "010": "등록되지 않은 키",
  "011": "사용할 수 없는 키",
  "012": "접근할 수 없는 IP",
  "013": "조회된 데이터가 없습니다.",
  "020": "요청 제한을 초과했습니다.",
  "100": "요청한 값이 올바르지 않습니다.",
  "800": "DART 시스템 점검 중입니다.",
  "900": "알 수 없는 오류",
};

async function getJson(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("crtfc_key", apiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new DartError("DART 서버에 연결하지 못했습니다.");
  }

  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) throw new DartError("DART 응답을 읽지 못했습니다.");

  const status = String(body.status ?? "");
  // 013(데이터 없음)은 오류가 아니라 "그런 자료가 없다"는 뜻이다.
  if (status !== "000" && status !== "013") {
    throw new DartError(STATUS_MESSAGE[status] ?? "DART 조회에 실패했습니다.");
  }

  return body;
}

/* ------------------------------------------------------------
   고유번호 목록 내려받기 (운영자가 가끔 한 번씩 돌린다)
   ------------------------------------------------------------ */

/**
 * zip 안의 파일 하나를 꺼낸다.
 * DART 고유번호 파일은 항목이 하나뿐이라 압축 해제 라이브러리를 더하지 않고
 * 중앙 디렉터리를 직접 읽어 처리한다.
 */
function unzipSingleEntry(buffer: Buffer): Buffer {
  // 끝에서 EOCD(End of Central Directory) 를 찾는다.
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new DartError("고유번호 파일 형식을 읽지 못했습니다.");

  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (buffer.readUInt32LE(cdOffset) !== 0x02014b50) {
    throw new DartError("고유번호 파일 형식을 읽지 못했습니다.");
  }

  const method = buffer.readUInt16LE(cdOffset + 10);
  const compressedSize = buffer.readUInt32LE(cdOffset + 20);
  const localOffset = buffer.readUInt32LE(cdOffset + 42);

  const nameLen = buffer.readUInt16LE(localOffset + 26);
  const extraLen = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  const data = buffer.subarray(dataStart, dataStart + compressedSize);

  if (method === 0) return Buffer.from(data); // 압축 안 함
  if (method === 8) return inflateRawSync(data); // deflate
  throw new DartError("고유번호 파일의 압축 방식을 지원하지 않습니다.");
}

export type DartCorp = {
  corp_code: string;
  corp_name: string;
  stock_code: string | null;
  modify_date: string | null;
};

/** 상장사만 추려서 돌려준다. 전체 10만 건을 다 담을 필요가 없다. */
export async function fetchListedCorps(): Promise<DartCorp[]> {
  const url = new URL(`${BASE}/corpCode.xml`);
  url.searchParams.set("crtfc_key", apiKey());

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new DartError("고유번호 파일을 내려받지 못했습니다.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // 키가 잘못되면 zip 대신 JSON 오류가 온다.
  if (buffer.subarray(0, 2).toString() !== "PK") {
    const text = buffer.toString("utf8").slice(0, 300);
    const status = text.match(/"status"\s*:\s*"(\d+)"/)?.[1] ?? "";
    throw new DartError(
      STATUS_MESSAGE[status] ?? "고유번호 파일을 받지 못했습니다.",
    );
  }

  const xml = unzipSingleEntry(buffer).toString("utf8");

  const corps: DartCorp[] = [];
  const pattern =
    /<list>\s*<corp_code>([^<]*)<\/corp_code>\s*<corp_name>([^<]*)<\/corp_name>\s*<corp_eng_name>[^<]*<\/corp_eng_name>\s*<stock_code>([^<]*)<\/stock_code>\s*<modify_date>([^<]*)<\/modify_date>\s*<\/list>/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const stock = match[3].trim();
    if (!stock) continue; // 상장사만
    corps.push({
      corp_code: match[1].trim(),
      corp_name: match[2].trim(),
      stock_code: stock,
      modify_date: match[4].trim() || null,
    });
  }

  if (corps.length === 0) {
    // 형식이 바뀌었을 수 있다. 예전 형식(corp_eng_name 없음)도 시도한다.
    const fallback =
      /<corp_code>([^<]*)<\/corp_code>\s*<corp_name>([^<]*)<\/corp_name>[\s\S]*?<stock_code>([^<]*)<\/stock_code>\s*<modify_date>([^<]*)<\/modify_date>/g;
    while ((match = fallback.exec(xml)) !== null) {
      const stock = match[3].trim();
      if (!stock) continue;
      corps.push({
        corp_code: match[1].trim(),
        corp_name: match[2].trim(),
        stock_code: stock,
        modify_date: match[4].trim() || null,
      });
    }
  }

  return corps;
}

/* ------------------------------------------------------------
   기업 조회 + 하루 캐시
   ------------------------------------------------------------ */

export type CompanyBrief = {
  corpName: string | null;
  ceoName: string | null;
  establishDate: string | null;
  address: string | null;
  homepage: string | null;
  industryCode: string | null;
  stockCode: string | null;
};

export type FinanceRow = { label: string; amount: string };

export type DisclosureRow = {
  date: string;
  title: string;
  receiptNo: string;
};

export type CompanyReport = {
  corpCode: string;
  brief: CompanyBrief | null;
  finances: FinanceRow[];
  financeYear: string | null;
  disclosures: DisclosureRow[];
  notes: string[];
};

function formatAmount(raw: string): string {
  const value = Number.parseInt(String(raw).replace(/,/g, ""), 10);
  if (Number.isNaN(value)) return String(raw);
  const eok = value / 100_000_000;
  if (Math.abs(eok) >= 10_000) {
    return `${(eok / 10_000).toFixed(1)}조원`;
  }
  return `${Math.round(eok).toLocaleString()}억원`;
}

/** 캐시를 먼저 보고, 없으면 DART 에 물어본 뒤 오늘 날짜로 저장한다. */
export async function loadCompanyReport(
  corpCode: string,
): Promise<CompanyReport> {
  const admin = createAdminClient();
  const cacheKey = `company:${corpCode}`;
  const today = todayInSeoul();

  const { data: cached } = await admin
    .from("dart_cache")
    .select("payload")
    .eq("cache_key", cacheKey)
    .eq("fetched_on", today)
    .maybeSingle();

  if (cached?.payload) {
    return cached.payload as CompanyReport;
  }

  const notes: string[] = [];

  // 1) 기업개황
  let brief: CompanyBrief | null = null;
  try {
    const body = await getJson("company.json", { corp_code: corpCode });
    if (String(body.status) === "000") {
      brief = {
        corpName: (body.corp_name as string) ?? null,
        ceoName: (body.ceo_nm as string) ?? null,
        establishDate: (body.est_dt as string) ?? null,
        address: (body.adres as string) ?? null,
        homepage: (body.hm_url as string) ?? null,
        industryCode: (body.induty_code as string) ?? null,
        stockCode: (body.stock_code as string) ?? null,
      };
    } else {
      notes.push("기업개황 자료가 없습니다.");
    }
  } catch (error) {
    notes.push(
      error instanceof DartError ? error.message : "기업개황을 받지 못했습니다.",
    );
  }

  // 2) 최근 재무 (사업보고서 기준. 올해 자료가 없으면 작년으로 한 번 더)
  const finances: FinanceRow[] = [];
  let financeYear: string | null = null;
  const thisYear = Number(today.slice(0, 4));

  for (const year of [thisYear - 1, thisYear - 2]) {
    try {
      const body = await getJson("fnlttSinglAcnt.json", {
        corp_code: corpCode,
        bsns_year: String(year),
        reprt_code: "11011", // 사업보고서
      });
      const list = (body.list ?? []) as Record<string, string>[];
      if (list.length === 0) continue;

      const wanted = ["자산총계", "부채총계", "자본총계", "매출액", "영업이익", "당기순이익"];
      for (const name of wanted) {
        const row = list.find(
          (item) =>
            item.account_nm === name &&
            (item.fs_div === "CFS" || item.fs_div === "OFS"),
        );
        if (row?.thstrm_amount) {
          finances.push({ label: name, amount: formatAmount(row.thstrm_amount) });
        }
      }
      if (finances.length > 0) {
        financeYear = String(year);
        break;
      }
    } catch (error) {
      if (error instanceof DartError) notes.push(error.message);
      break;
    }
  }

  if (finances.length === 0 && notes.length === 0) {
    notes.push("공시된 재무 자료를 찾지 못했습니다.");
  }

  // 3) 최근 공시 5건
  const disclosures: DisclosureRow[] = [];
  try {
    const end = today.replace(/-/g, "");
    const startDate = new Date(`${today}T00:00:00Z`);
    startDate.setUTCMonth(startDate.getUTCMonth() - 6);
    const begin = startDate.toISOString().slice(0, 10).replace(/-/g, "");

    const body = await getJson("list.json", {
      corp_code: corpCode,
      bgn_de: begin,
      end_de: end,
      page_count: "5",
    });
    for (const item of (body.list ?? []) as Record<string, string>[]) {
      disclosures.push({
        date: item.rcept_dt ?? "",
        title: item.report_nm ?? "",
        receiptNo: item.rcept_no ?? "",
      });
    }
  } catch (error) {
    if (error instanceof DartError) notes.push(error.message);
  }

  const report: CompanyReport = {
    corpCode,
    brief,
    finances,
    financeYear,
    disclosures,
    notes,
  };

  await admin
    .from("dart_cache")
    .upsert({ cache_key: cacheKey, fetched_on: today, payload: report });

  return report;
}
