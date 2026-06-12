import { getSupabaseClient } from "./supabase";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 20;

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const supabase = getSupabaseClient();
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MS).toISOString();

  const { count, error } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", windowStart);

  if (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true, retryAfter: 0 };
  }

  if (count && count >= MAX_REQUESTS) {
    const { data } = await supabase
      .from("rate_limits")
      .select("created_at")
      .eq("ip_address", ip)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true })
      .limit(1)
      .returns<{ created_at: string }[]>();

    const oldest = data?.[0]?.created_at;
    if (oldest) {
      const retryAfter = Math.ceil((new Date(oldest).getTime() + WINDOW_MS - now) / 1000);
      return { allowed: false, retryAfter };
    }
    return { allowed: false, retryAfter: 60 };
  }

  await supabase.from("rate_limits").insert({ ip_address: ip });

  return { allowed: true, retryAfter: 0 };
}

export async function resetRateLimit(ip: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from("rate_limits").delete().eq("ip_address", ip);
}
