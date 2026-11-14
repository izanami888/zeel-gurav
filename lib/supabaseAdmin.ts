import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Зөвхөн сервер талд (API route) ашиглах Supabase клиент.
// service_role түлхүүр нь Row Level Security-г тойрдог тул хэзээ ч
// хөтөч рүү илгээж болохгүй (NEXT_PUBLIC_ угтваргүй байгаа шалтгаан).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

/** Онлайн тоглоомд хэрэгтэй гурван хувьсагч бүгд тохируулагдсан эсэх. */
export function isOnlineConfigured(): boolean {
  return Boolean(supabaseUrl && anonKey && serviceRoleKey);
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseUrl || !serviceRoleKey) return null;
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        // Next.js fetch-ийн хариуг кэшлэхээс сэргийлнэ.
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    });
  }
  return adminClient;
}
