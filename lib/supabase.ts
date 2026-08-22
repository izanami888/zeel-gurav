import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Хэрэв орчны хувьсагч тохируулаагүй бол (жишээ нь: локал дээр Supabase
// холбоогүй үед) клиентийг null болгож, дуудагч талд аюулгүйfallback
// ашиглах боломжтой болгоно (жишээ нь: зар харуулахгүй байх).
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
