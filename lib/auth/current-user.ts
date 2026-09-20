import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  userId: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
};

/**
 * 로그인한 사용자의 프로필을 가져온다. 로그인 상태가 아니면 null.
 * RLS 덕분에 본인 행만 조회된다.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, must_change_password")
    .eq("user_id", user.id)
    .single();

  if (!data) return null;

  return {
    userId: data.user_id,
    username: data.username,
    displayName: data.display_name,
    mustChangePassword: data.must_change_password,
  };
}
