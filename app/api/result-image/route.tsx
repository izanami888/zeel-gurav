import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const WIDTH = 1080;
const HEIGHT = 1920;

/**
 * 1080x1920 (Instagram Story хэмжээ) үр дүнгийн PNG зураг үүсгэнэ.
 * Query params:
 *   game     - тоглоомын нэр (жишээ: "Хөндлөвч тоглоом")
 *   result   - гол текст (жишээ: "Тоглогч 1 яллаа!")
 *   subtitle - нэмэлт тайлбар/статистик (заавал биш)
 *
 * Энэ маршрутыг ямар ч тоглоомоос дахин ашиглаж болно —
 * зөвхөн game/result/subtitle-г дамжуулна. Шинэ тоглоом нэмэхэд
 * энэ файлыг өөрчлөх шаардлагагүй.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game") ?? "Тоглоом";
  const result = searchParams.get("result") ?? "Тоглоом дууслаа";
  const subtitle = searchParams.get("subtitle") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "80px 60px",
          backgroundImage:
            "linear-gradient(160deg, #0B1F3A 0%, #13315C 55%, #0B1F3A 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Толгой хэсэг: сайтын нэр */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 56 }}>🎲</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#F1D57A" }}>
            Тоглоомын Тавцан
          </div>
        </div>

        {/* Гол үр дүн */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              fontSize: 34,
              color: "#D4AF37",
              letterSpacing: 4,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            {game}
          </div>
          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1.15,
              display: "flex",
              maxWidth: 880,
            }}
          >
            {result}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 36, color: "#FFFFFFB0", display: "flex" }}>
              {subtitle}
            </div>
          ) : null}
        </div>

        {/* Доод watermark */}
        <div
          style={{
            fontSize: 28,
            color: "#FFFFFF80",
            display: "flex",
          }}
        >
          playboard.mn
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}
