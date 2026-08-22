import { supabase } from "./supabase";

export interface Ad {
  id: string;
  company_name: string;
  image_url: string;
  link_url: string;
  placement: "homepage" | "result_screen";
  active: boolean;
}

/**
 * Тухайн байршилд (placement) идэвхтэй нэг зар татаж авна.
 * Supabase тохируулаагүй, эсвэл тохирох зар олдоогүй бол `null` буцаана —
 * дуудагч тал (AdBanner) энэ үед house/placeholder зар харуулна.
 */
export async function fetchActiveAd(
  placement: Ad["placement"]
): Promise<Ad | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("ads")
    .select("id, company_name, image_url, link_url, placement, active")
    .eq("placement", placement)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Ad;
}

// Энгийн тоолуур — заавал 100% алдаагүй байх шаардлагагүй тул
// амжилтгүй болсон ч дуудагч талыг блоклохгүй (fire-and-forget).
export function recordAdImpression(adId: string) {
  if (!supabase) return;
  void supabase.rpc("increment_ad_impressions", { ad_id: adId });
}

export function recordAdClick(adId: string) {
  if (!supabase) return;
  void supabase.rpc("increment_ad_clicks", { ad_id: adId });
}

// TODO(admin): Ирээдүйд /admin/ads маршрутад зар нэмэх/засах/устгах,
// идэвхжүүлэх/идэвхгүй болгох, статистик (impressions/clicks) харах
// энгийн удирдлагын хуудас нэмнэ. Одоогоор зар Supabase Table Editor-оор
// шууд удирддаг.
