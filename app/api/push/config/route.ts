import { NextResponse } from "next/server";

/**
 * 배포 서버에 VAPID 공개 키가 들어와 있는지 확인하는 경로.
 *
 * 공개 키는 원래 브라우저로 그대로 나가는 값이라 비밀이 아니다.
 * 그래도 굳이 값을 내보낼 이유는 없으니 "있다/없다" 와 길이만 알려 준다.
 * 로그인 없이 볼 수 있어야 알림이 안 될 때 바로 확인할 수 있다.
 */
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";

  return NextResponse.json({
    hasPublicKey: publicKey.length > 0,
    // 정상값은 87자다. 길이가 다르면 복사할 때 잘렸다는 뜻이다.
    publicKeyLength: publicKey.length,
    hasPrivateKey: privateKey.length > 0,
    privateKeyLength: privateKey.length,
  });
}

export const dynamic = "force-dynamic";
