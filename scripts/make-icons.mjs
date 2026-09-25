/**
 * 앱 아이콘 만들기.
 *
 *   node scripts/make-icons.mjs
 *
 * 도형 두 개뿐이다 — 둥근 네모 바탕과 흰 체크.
 * 그림판 프로그램이나 추가 패키지 없이, 픽셀을 직접 계산해서 PNG 로 저장한다.
 * (node 에 들어 있는 zlib 만 쓴다)
 *
 * maskable 은 안드로이드가 제 마음대로 모서리를 깎기 때문에
 * 네모를 꽉 채우고 체크를 안쪽으로 작게 넣는다. 안 그러면 모서리가 잘려 보인다.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

/** 브랜드 파랑 (globals.css 의 --color-brand-600) */
const BRAND = [37, 99, 235];
const WHITE = [255, 255, 255];

/* ------------------------------------------------------------
   거리 함수 — 도형 경계까지의 거리를 재서 가장자리를 부드럽게 만든다
   ------------------------------------------------------------ */

/** 둥근 네모 안쪽이면 음수 */
function roundedRectDistance(x, y, half, radius) {
  const dx = Math.abs(x) - (half - radius);
  const dy = Math.abs(y) - (half - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - radius;
}

/** 선분까지의 거리 */
function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/** 두 선분을 이은 체크 표시까지의 거리 */
function checkDistance(x, y, thickness) {
  // 정규화 좌표(-0.5 ~ 0.5) 기준 꺾은선
  const d = Math.min(
    segmentDistance(x, y, -0.22, 0.02, -0.06, 0.18),
    segmentDistance(x, y, -0.06, 0.18, 0.24, -0.16),
  );
  return d - thickness;
}

/* ------------------------------------------------------------
   PNG 쓰기
   ------------------------------------------------------------ */

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function writePng(path, size, pixels) {
  // 줄마다 앞에 필터 바이트(0) 를 붙인다 — PNG 형식이 요구한다
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8비트
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

/* ------------------------------------------------------------
   그리기
   ------------------------------------------------------------ */

function makeIcon({
  size,
  /** true 면 모서리를 깎지 않고 네모를 꽉 채운다 (maskable·애플용) */
  fullBleed = false,
  /** 체크 크기 (1 이면 기본) */
  checkScale = 1,
}) {
  const pixels = Buffer.alloc(size * size * 4);
  // 가장자리 한 픽셀 안에서 색이 섞이도록, 픽셀 하나를 4등분해 평균을 낸다
  const samples = [0.25, 0.75];

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let bg = 0;
      let fg = 0;

      for (const sy of samples) {
        for (const sx of samples) {
          const x = (px + sx) / size - 0.5;
          const y = (py + sy) / size - 0.5;

          const inBg = fullBleed
            ? 1
            : roundedRectDistance(x, y, 0.5, 0.115) <= 0
              ? 1
              : 0;
          bg += inBg;

          const thickness = 0.052 * checkScale;
          const cx = x / checkScale;
          const cy = y / checkScale;
          fg += checkDistance(cx, cy, thickness / checkScale) <= 0 ? 1 : 0;
        }
      }

      const n = samples.length * samples.length;
      const bgA = bg / n;
      const fgA = fg / n;

      // 바탕(파랑) 위에 체크(흰색)를 올린다
      const r = BRAND[0] * (1 - fgA) + WHITE[0] * fgA;
      const g = BRAND[1] * (1 - fgA) + WHITE[1] * fgA;
      const b = BRAND[2] * (1 - fgA) + WHITE[2] * fgA;

      const i = (py * size + px) * 4;
      pixels[i] = Math.round(r);
      pixels[i + 1] = Math.round(g);
      pixels[i + 2] = Math.round(b);
      pixels[i + 3] = Math.round(bgA * 255);
    }
  }

  return pixels;
}

const jobs = [
  { path: "public/icon-192.png", size: 192, fullBleed: false, checkScale: 1 },
  { path: "public/icon-512.png", size: 512, fullBleed: false, checkScale: 1 },
  // 안드로이드가 모서리를 깎으므로 꽉 채우고 체크는 안쪽으로 (안전 영역 80%)
  {
    path: "public/icon-maskable-512.png",
    size: 512,
    fullBleed: true,
    checkScale: 0.72,
  },
  // 아이폰은 알아서 둥글게 깎는다. 투명한 곳이 있으면 검게 나온다.
  {
    path: "public/apple-touch-icon.png",
    size: 180,
    fullBleed: true,
    checkScale: 0.82,
  },
];

for (const job of jobs) {
  writePng(job.path, job.size, makeIcon(job));
  console.log(`만듦: ${job.path} (${job.size}x${job.size})`);
}
