export interface ResultImageParams {
  game: string;
  result: string;
  subtitle?: string;
}

/**
 * Дурын тоглоомоос дуудаж болох модуль хэсэг: үр дүнгийн зургийн URL үүсгэнэ.
 * (game, result, subtitle) дамжуулснаар /api/result-image эндпойнт
 * 1080x1920 PNG үүсгэдэг.
 */
export function buildResultImageUrl({ game, result, subtitle }: ResultImageParams): string {
  const params = new URLSearchParams({ game, result });
  if (subtitle) params.set("subtitle", subtitle);
  return `/api/result-image?${params.toString()}`;
}

/**
 * Instagram Story-д хуваалцахыг оролдоно (Web Share API-аар зурган файл
 * дамжуулж, төхөөрөмжийн Share sheet-с Instagram Stories сонгох боломж
 * гарна). Дэмжигдэхгүй бол `false` буцаана — дуудагч тал татаж авах
 * fallback-руу шилжинэ.
 *
 * Тайлбар: вэб хуудаснаас шууд "instagram-stories://" гэсэн native
 * deep link рүү зураг дамжуулах нь зөвхөн native апп-с боломжтой тул
 * (Instagram-ийн албан ёсны Sharing to Stories API native SDK шаарддаг),
 * вэб дээрх практик хамгийн сайн шийдэл бол OS-ийн Share sheet юм.
 */
export async function tryShareResultImage(
  imageUrl: string,
  fileName: string,
  shareText: string
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: "image/png" });

    const canShareFiles =
      "canShare" in navigator && navigator.canShare?.({ files: [file] });
    if (!canShareFiles) return false;

    await navigator.share({
      files: [file],
      title: "Тоглоомын Тавцан",
      text: shareText,
    });
    return true;
  } catch {
    // Хэрэглэгч цуцалсан эсвэл дэмжигдэхгүй — fallback руу шилжинэ.
    return false;
  }
}

export async function downloadResultImage(imageUrl: string, fileName: string) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
