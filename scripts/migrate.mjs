// supabase/migrations/*.sql 을 파일명 순서대로 적용하는 스크립트.
// 이미 적용한 파일은 건너뛴다.
//
// 사용법 (프로젝트 폴더에서):
//   npm run db:status          현재 적용 상태만 확인
//   npm run db:migrate         아직 적용 안 된 파일을 순서대로 적용
//   npm run db:mark -- <파일명>  실행하지 않고 "적용됨"으로만 기록
//                               (SQL Editor 로 이미 돌린 파일용)
//
// DATABASE_URL 은 .env.local 에서 읽는다. 로컬 전용이며 Vercel 에는 넣지 않는다.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const CREATE_LEDGER = `
  create table if not exists public.schema_migrations (
    filename   text primary key,
    applied_at timestamptz not null default now()
  );
  -- CLAUDE.md 3장 1번: 모든 테이블에 RLS. 정책을 만들지 않아 브라우저에서는 접근 불가.
  alter table public.schema_migrations enable row level security;
  revoke all on table public.schema_migrations from anon, authenticated;
`;

/**
 * Supabase 는 프로젝트에 따라 인증서 검증이 되기도 하고 안 되기도 한다.
 * 먼저 검증하는 쪽으로 붙어 보고, 인증서 문제일 때만 검증을 완화해 재시도한다.
 */
async function connectOnce() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(".env.local 에 DATABASE_URL 이 없습니다.");
  }

  const strict = new pg.Client({ connectionString, connectionTimeoutMillis: 15000 });
  try {
    await strict.connect();
    return strict;
  } catch (error) {
    try {
      await strict.end();
    } catch {}

    const isCertProblem = /certificate|self[- ]signed|SSL|TLS/i.test(error.message);
    if (!isCertProblem) throw error;

    console.warn("! 인증서 검증에 실패해 검증을 생략하고 재시도합니다.");
    const relaxed = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    await relaxed.connect();
    return relaxed;
  }
}

/**
 * Supabase 풀러는 간헐적으로 timeout 이나 인증 실패를 돌려준다.
 * 같은 설정으로 바로 다시 붙으면 대개 성공하므로 몇 번 재시도한다.
 */
async function connect(attempts = 4) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await connectOnce();
    } catch (error) {
      lastError = error;
      const transient =
        /timeout|password authentication failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|terminating connection/i.test(
          error.message,
        );
      if (!transient || i === attempts) throw error;
      console.warn(`! 접속 실패 (${i}/${attempts}) - 잠시 후 재시도합니다.`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * i));
    }
  }
  throw lastError;
}

async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function listApplied(client) {
  const { rows } = await client.query(
    "select filename from public.schema_migrations order by filename",
  );
  return new Set(rows.map((row) => row.filename));
}

async function main() {
  const [command = "migrate", ...args] = process.argv.slice(2);

  const client = await connect();
  try {
    await client.query(CREATE_LEDGER);

    const files = await listMigrationFiles();
    const applied = await listApplied(client);
    const pending = files.filter((file) => !applied.has(file));

    if (command === "status") {
      console.log(`마이그레이션 폴더: ${MIGRATIONS_DIR}\n`);
      for (const file of files) {
        console.log(`  ${applied.has(file) ? "[적용됨]  " : "[미적용]  "}${file}`);
      }
      const orphans = [...applied].filter((file) => !files.includes(file));
      if (orphans.length > 0) {
        console.log("\n  기록에는 있으나 파일이 없는 항목:");
        for (const file of orphans) console.log(`    ${file}`);
      }
      console.log(`\n총 ${files.length}개 중 ${pending.length}개 미적용`);
      return;
    }

    if (command === "mark") {
      if (args.length === 0) {
        throw new Error("표시할 파일명을 인자로 주세요. 예: npm run db:mark -- 001_xxx.sql");
      }
      for (const file of args) {
        if (!files.includes(file)) {
          throw new Error(`${file} 이(가) 마이그레이션 폴더에 없습니다.`);
        }
        if (applied.has(file)) {
          console.log(`  이미 적용됨으로 기록되어 있음: ${file}`);
          continue;
        }
        await client.query(
          "insert into public.schema_migrations (filename) values ($1)",
          [file],
        );
        console.log(`  실행하지 않고 적용됨으로 기록: ${file}`);
      }
      return;
    }

    if (command !== "migrate") {
      throw new Error(`알 수 없는 명령: ${command} (migrate | status | mark)`);
    }

    if (pending.length === 0) {
      console.log("적용할 새 마이그레이션이 없습니다.");
      return;
    }

    for (const file of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`  적용 중: ${file} ... `);

      // 파일 하나를 통째로 한 트랜잭션에서 실행한다.
      // 중간에 실패하면 그 파일의 변경은 전부 취소되고, 기록도 남지 않는다.
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations (filename) values ($1)",
          [file],
        );
        await client.query("commit");
        console.log("완료");
      } catch (error) {
        await client.query("rollback");
        console.log("실패");
        console.error(`\n${file} 적용 중 오류가 나서 중단합니다.`);
        console.error(error.message);
        process.exitCode = 1;
        return;
      }
    }

    console.log(`\n${pending.length}개 적용 완료.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("오류:", error.message);
  process.exitCode = 1;
});
